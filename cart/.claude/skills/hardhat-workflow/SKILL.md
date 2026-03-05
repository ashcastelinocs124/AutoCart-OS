---
name: hardhat-workflow
description: Use when working with Hardhat for Ethereum development - compiling Solidity, running a local node, deploying contracts, or writing/running contract tests with ethers.js.
---

# Hardhat Workflow

## Overview
Hardhat is the local Ethereum dev environment. It provides a local blockchain node, Solidity compiler, test runner, and deploy scripts in one toolchain.

## Key Commands

| Action | Command |
|--------|---------|
| Compile contracts | `npx hardhat compile` |
| Run all tests | `npx hardhat test` |
| Start local node | `npx hardhat node` |
| Deploy to local | `npx hardhat run scripts/deploy.js --network localhost` |
| Deploy to hardhat (in-process) | `npx hardhat run scripts/deploy.js` |
| Open console | `npx hardhat console --network localhost` |

## Project Structure
```
contracts/     ← Solidity source files
test/          ← JS/TS test files (mocha + chai)
scripts/       ← deploy.js and other scripts
artifacts/     ← compiled ABIs (auto-generated, gitignore)
hardhat.config.js
```

## Writing Tests (ethers.js v6)

```js
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MyContract", function () {
  let contract, owner, user1;

  beforeEach(async () => {
    [owner, user1] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("MyContract");
    contract = await Factory.deploy();
    await contract.waitForDeployment();
  });

  it("does the thing", async () => {
    await contract.connect(user1).doThing();
    expect(await contract.value()).to.equal(42n); // bigint in ethers v6
  });
});
```

## Parsing Events (ethers.js v6)
```js
const receipt = await tx.wait();
const log = receipt.logs.find(l => l.fragment?.name === "MyEvent");
const value = log.args[0]; // positional, or log.args.fieldName
```

## Deploy Script Pattern
```js
const { ethers } = require("hardhat");
async function main() {
  const [deployer] = await ethers.getSigners();
  const Factory = await ethers.getContractFactory("MyContract");
  const contract = await Factory.deploy(/* constructor args */);
  await contract.waitForDeployment();
  console.log("Deployed to:", await contract.getAddress());
}
main().catch(e => { console.error(e); process.exit(1); });
```

## Hardhat Config for Local Network
```js
module.exports = {
  solidity: "0.8.24",
  networks: {
    hardhat: { chainId: 1337 },
    localhost: { url: "http://127.0.0.1:8545" }
  }
};
```

## Common Mistakes
| Mistake | Fix |
|---------|-----|
| `ethers.BigNumber` not found | ethers v6 uses native `bigint` — use `42n` not `BigNumber.from(42)` |
| `getAddress()` vs `.address` | ethers v6: use `await contract.getAddress()` |
| Tests pass without `await contract.waitForDeployment()` | Add it — without it, contract may not be ready |
| `from_block=0` missing in Python event query | Always pass `from_block=0` to `get_logs` |
