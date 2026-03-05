import { network } from "hardhat";
import assert from "node:assert/strict";

describe("AgentMarketplace", function () {
  let ethers;
  let owner, seller, buyer, other;
  let marketplace;
  const PRICE_WEI = 1_000_000_000_000_000n; // 0.001 ETH

  beforeEach(async function () {
    ({ ethers } = await network.connect());
    [owner, seller, buyer, other] = await ethers.getSigners();

    marketplace = await ethers.deployContract("AgentMarketplace", [], {
      from: owner.address,
    });

    // Register the seller
    await marketplace
      .connect(seller)
      .registerService(
        "TestAgent",
        "summarization",
        "https://agent.example.com",
        PRICE_WEI
      );
  });

  it("registers a seller agent", async function () {
    const agent = await marketplace.agents(seller.address);
    assert.equal(agent.name, "TestAgent");
    assert.equal(agent.active, true);
    assert.equal(agent.priceWei, PRICE_WEI);
  });

  it("creates an agreement and locks ETH", async function () {
    const balanceBefore = await ethers.provider.getBalance(
      await marketplace.getAddress()
    );
    assert.equal(balanceBefore, 0n);

    await marketplace
      .connect(buyer)
      .createAgreement(seller.address, "Summarize this document", {
        value: PRICE_WEI,
      });

    const balanceAfter = await ethers.provider.getBalance(
      await marketplace.getAddress()
    );
    assert.equal(balanceAfter, PRICE_WEI);
  });

  it("releases ETH to seller minus 1% fee on approval", async function () {
    const tx = await marketplace
      .connect(buyer)
      .createAgreement(seller.address, "Task for approval", {
        value: PRICE_WEI,
      });
    const receipt = await tx.wait();

    // Extract agreementHash from the AgreementCreated event
    const event = receipt.logs
      .map((log) => {
        try {
          return marketplace.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((e) => e && e.name === "AgreementCreated");

    const agreementHash = event.args.agreementHash;

    const sellerBalanceBefore = await ethers.provider.getBalance(
      seller.address
    );

    const approveTx = await marketplace
      .connect(buyer)
      .approveCompletion(agreementHash);
    await approveTx.wait();

    const sellerBalanceAfter = await ethers.provider.getBalance(seller.address);

    // Seller should receive 99% of PRICE_WEI (1% platform fee)
    const fee = (PRICE_WEI * 100n) / 10000n;
    const expectedPayout = PRICE_WEI - fee;

    assert.equal(
      sellerBalanceAfter - sellerBalanceBefore,
      expectedPayout,
      "Seller should receive payout minus 1% fee"
    );

    // Reputation should have incremented
    const agent = await marketplace.agents(seller.address);
    assert.equal(agent.reputation, 1n);
  });

  it("refunds buyer on dispute", async function () {
    const tx = await marketplace
      .connect(buyer)
      .createAgreement(seller.address, "Task that will be disputed", {
        value: PRICE_WEI,
      });
    const receipt = await tx.wait();

    const event = receipt.logs
      .map((log) => {
        try {
          return marketplace.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((e) => e && e.name === "AgreementCreated");

    const agreementHash = event.args.agreementHash;

    const buyerBalanceBefore = await ethers.provider.getBalance(buyer.address);

    const disputeTx = await marketplace
      .connect(buyer)
      .raiseDispute(agreementHash);
    const disputeReceipt = await disputeTx.wait();

    const buyerBalanceAfter = await ethers.provider.getBalance(buyer.address);

    // Buyer should get PRICE_WEI back, minus gas costs
    const gasUsed = disputeReceipt.gasUsed * disputeReceipt.gasPrice;
    const netChange = buyerBalanceAfter - buyerBalanceBefore;
    const refundedMinusGas = PRICE_WEI - gasUsed;

    assert.equal(
      netChange,
      refundedMinusGas,
      "Buyer should be refunded escrow amount minus gas"
    );
  });

  it("reverts if non-buyer tries to approve", async function () {
    const tx = await marketplace
      .connect(buyer)
      .createAgreement(seller.address, "Task for non-buyer test", {
        value: PRICE_WEI,
      });
    const receipt = await tx.wait();

    const event = receipt.logs
      .map((log) => {
        try {
          return marketplace.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((e) => e && e.name === "AgreementCreated");

    const agreementHash = event.args.agreementHash;

    await assert.rejects(
      () =>
        marketplace.connect(other).approveCompletion(agreementHash),
      (err) => {
        assert.ok(
          err.message.includes("Not buyer"),
          `Expected 'Not buyer' in error, got: ${err.message}`
        );
        return true;
      }
    );
  });
});
