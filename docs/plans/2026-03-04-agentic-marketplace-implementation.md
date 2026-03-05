# Agentic Marketplace Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a simulation of an Ethereum-based marketplace where AI agents autonomously discover, hire, and pay other AI agents using smart contracts.

**Architecture:** Single `AgentMarketplace.sol` contract handles registry, escrow, agreement hashing, payment release, and reputation. A Python `AgentMatcher` service indexes on-chain registrations and uses LLM embeddings to match buyer tasks to sellers. A buyer agent LLM decides who to hire, creates an on-chain agreement, calls the seller off-chain, and approves payment on successful output.

**Tech Stack:** Solidity, Hardhat, ethers.js, Python 3.11+, web3.py, FastAPI, OpenAI API (embeddings + chat), pytest, hardhat-toolbox

---

## Project Structure

```
agentic-marketplace/
├── contracts/
│   └── AgentMarketplace.sol
├── test/
│   └── AgentMarketplace.test.js
├── scripts/
│   └── deploy.js
├── hardhat.config.js
├── package.json
├── agents/
│   ├── matcher/
│   │   └── agent_matcher.py
│   ├── sellers/
│   │   ├── summarization_agent.py
│   │   ├── websearch_agent.py
│   │   └── codereviewer_agent.py
│   ├── buyer/
│   │   └── buyer_agent.py
│   └── simulation/
│       └── run_simulation.py
├── abi/
│   └── AgentMarketplace.json     (generated after compile)
├── requirements.txt
└── .env
```

---

## Task 1: Project Setup

**Files:**
- Create: `agentic-marketplace/package.json`
- Create: `agentic-marketplace/hardhat.config.js`
- Create: `agentic-marketplace/requirements.txt`
- Create: `agentic-marketplace/.env`

**Step 1: Initialize Node project and install Hardhat**

```bash
mkdir -p /Users/ash/Desktop/agentic-marketplace
cd /Users/ash/Desktop/agentic-marketplace
npm init -y
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox
npx hardhat init
# Choose: Create a JavaScript project, accept defaults
```

Expected: `hardhat.config.js`, `contracts/`, `test/`, `scripts/` created.

**Step 2: Create hardhat config**

Replace `hardhat.config.js` with:
```js
require("@nomicfoundation/hardhat-toolbox");

module.exports = {
  solidity: "0.8.24",
  networks: {
    hardhat: {
      chainId: 1337
    }
  }
};
```

**Step 3: Set up Python environment**

```bash
cd /Users/ash/Desktop/agentic-marketplace
python3 -m venv venv
source venv/bin/activate
```

**Step 4: Create requirements.txt**

```
web3==6.15.1
fastapi==0.110.0
uvicorn==0.29.0
openai==1.30.0
httpx==0.27.0
python-dotenv==1.0.1
pytest==8.1.1
pytest-asyncio==0.23.6
numpy==1.26.4
```

**Step 5: Install Python dependencies**

```bash
pip install -r requirements.txt
```

**Step 6: Create .env**

```
OPENAI_API_KEY=your_key_here
CONTRACT_ADDRESS=             # filled after deploy
RPC_URL=http://127.0.0.1:8545
```

**Step 7: Commit**

```bash
git init
git add .
git commit -m "chore: project setup - hardhat + python env"
```

---

## Task 2: Smart Contract

**Files:**
- Create: `contracts/AgentMarketplace.sol`

**Step 1: Write the contract**

```solidity
// contracts/AgentMarketplace.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract AgentMarketplace is ReentrancyGuard {

    // ─── Enums & Structs ────────────────────────────────────────────
    enum Status { PENDING, COMPLETED, DISPUTED, EXPIRED }

    struct Agent {
        string  name;
        string  capabilities;   // comma-separated tags
        string  endpoint;       // off-chain URL
        uint256 priceWei;
        uint256 reputation;
        bool    active;
    }

    struct Agreement {
        bytes32 agreementHash;
        address buyer;
        address seller;
        string  taskDescription;
        uint256 amountEscrowed;
        Status  status;
        uint256 createdAt;
    }

    // ─── State ──────────────────────────────────────────────────────
    mapping(address => Agent)    public agents;
    mapping(bytes32 => Agreement) public agreements;

    address public owner;
    uint256 public constant PLATFORM_FEE_BPS = 100; // 1%
    uint256 public constant EXPIRY_SECONDS    = 7 days;

    // ─── Events ─────────────────────────────────────────────────────
    event AgentRegistered(address indexed wallet, string name, uint256 priceWei);
    event AgreementCreated(bytes32 indexed agreementHash, address indexed buyer, address indexed seller, uint256 amount);
    event AgreementCompleted(bytes32 indexed agreementHash, address indexed seller, uint256 amount);
    event AgreementDisputed(bytes32 indexed agreementHash);
    event AgreementExpired(bytes32 indexed agreementHash);

    // ─── Constructor ────────────────────────────────────────────────
    constructor() {
        owner = msg.sender;
    }

    // ─── Functions ──────────────────────────────────────────────────

    function registerService(
        string calldata name,
        string calldata capabilities,
        string calldata endpoint,
        uint256 priceWei
    ) external {
        agents[msg.sender] = Agent(name, capabilities, endpoint, priceWei, agents[msg.sender].reputation, true);
        emit AgentRegistered(msg.sender, name, priceWei);
    }

    function createAgreement(
        address seller,
        string calldata taskDescription
    ) external payable returns (bytes32) {
        Agent storage a = agents[seller];
        require(a.active, "Seller not registered");
        require(msg.value >= a.priceWei, "Insufficient ETH");

        bytes32 h = keccak256(abi.encodePacked(msg.sender, seller, taskDescription, block.timestamp));
        require(agreements[h].createdAt == 0, "Hash collision");

        agreements[h] = Agreement(h, msg.sender, seller, taskDescription, msg.value, Status.PENDING, block.timestamp);
        emit AgreementCreated(h, msg.sender, seller, msg.value);
        return h;
    }

    function approveCompletion(bytes32 agreementHash) external nonReentrant {
        Agreement storage ag = agreements[agreementHash];
        require(ag.buyer == msg.sender, "Not buyer");
        require(ag.status == Status.PENDING, "Not pending");

        ag.status = Status.COMPLETED;
        uint256 fee = (ag.amountEscrowed * PLATFORM_FEE_BPS) / 10000;
        uint256 payout = ag.amountEscrowed - fee;

        (bool ok,) = ag.seller.call{value: payout}("");
        require(ok, "Transfer failed");
        (bool ok2,) = owner.call{value: fee}("");
        require(ok2, "Fee transfer failed");

        agents[ag.seller].reputation += 1;
        emit AgreementCompleted(agreementHash, ag.seller, payout);
    }

    function raiseDispute(bytes32 agreementHash) external nonReentrant {
        Agreement storage ag = agreements[agreementHash];
        require(ag.buyer == msg.sender, "Not buyer");
        require(ag.status == Status.PENDING, "Not pending");

        ag.status = Status.DISPUTED;
        (bool ok,) = ag.buyer.call{value: ag.amountEscrowed}("");
        require(ok, "Refund failed");
        emit AgreementDisputed(agreementHash);
    }

    function expireAgreement(bytes32 agreementHash) external nonReentrant {
        Agreement storage ag = agreements[agreementHash];
        require(ag.status == Status.PENDING, "Not pending");
        require(block.timestamp >= ag.createdAt + EXPIRY_SECONDS, "Not expired");

        ag.status = Status.EXPIRED;
        (bool ok,) = ag.buyer.call{value: ag.amountEscrowed}("");
        require(ok, "Refund failed");
        emit AgreementExpired(agreementHash);
    }
}
```

**Step 2: Install OpenZeppelin**

```bash
npm install @openzeppelin/contracts
```

**Step 3: Compile**

```bash
npx hardhat compile
```

Expected: `Compiled 1 Solidity file successfully`

**Step 4: Commit**

```bash
git add contracts/ package.json package-lock.json
git commit -m "feat: AgentMarketplace.sol - registry, escrow, agreement, reputation"
```

---

## Task 3: Smart Contract Tests

**Files:**
- Create: `test/AgentMarketplace.test.js`

**Step 1: Write failing tests**

```js
// test/AgentMarketplace.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AgentMarketplace", function () {
  let market, owner, seller, buyer;
  const PRICE = ethers.parseEther("0.01");

  beforeEach(async () => {
    [owner, seller, buyer] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("AgentMarketplace");
    market = await Factory.deploy();
    await market.waitForDeployment();
  });

  // ── Registration ──────────────────────────────────────────────────
  it("registers a seller agent", async () => {
    await market.connect(seller).registerService(
      "SummarizeBot", "summarization", "http://localhost:8001", PRICE
    );
    const agent = await market.agents(seller.address);
    expect(agent.name).to.equal("SummarizeBot");
    expect(agent.active).to.be.true;
    expect(agent.priceWei).to.equal(PRICE);
  });

  // ── Agreement creation ────────────────────────────────────────────
  it("creates an agreement and locks ETH", async () => {
    await market.connect(seller).registerService("Bot", "search", "http://x", PRICE);
    const balBefore = await ethers.provider.getBalance(await market.getAddress());

    const tx = await market.connect(buyer).createAgreement(
      seller.address, "Summarize this doc", { value: PRICE }
    );
    const receipt = await tx.wait();
    const event = receipt.logs.find(l => l.fragment?.name === "AgreementCreated");
    expect(event).to.not.be.undefined;

    const balAfter = await ethers.provider.getBalance(await market.getAddress());
    expect(balAfter - balBefore).to.equal(PRICE);
  });

  // ── Completion & payment ──────────────────────────────────────────
  it("releases ETH to seller minus 1% fee on approval", async () => {
    await market.connect(seller).registerService("Bot", "code", "http://x", PRICE);
    const tx = await market.connect(buyer).createAgreement(
      seller.address, "Review my code", { value: PRICE }
    );
    const receipt = await tx.wait();
    const event = receipt.logs.find(l => l.fragment?.name === "AgreementCreated");
    const hash = event.args[0];

    const sellerBefore = await ethers.provider.getBalance(seller.address);
    await market.connect(buyer).approveCompletion(hash);
    const sellerAfter = await ethers.provider.getBalance(seller.address);

    const fee = PRICE * 100n / 10000n;
    expect(sellerAfter - sellerBefore).to.equal(PRICE - fee);

    const agent = await market.agents(seller.address);
    expect(agent.reputation).to.equal(1n);
  });

  // ── Dispute ───────────────────────────────────────────────────────
  it("refunds buyer on dispute", async () => {
    await market.connect(seller).registerService("Bot", "x", "http://x", PRICE);
    const tx = await market.connect(buyer).createAgreement(
      seller.address, "Task", { value: PRICE }
    );
    const receipt = await tx.wait();
    const hash = receipt.logs.find(l => l.fragment?.name === "AgreementCreated").args[0];

    const buyerBefore = await ethers.provider.getBalance(buyer.address);
    const disputeTx = await market.connect(buyer).raiseDispute(hash);
    const disputeReceipt = await disputeTx.wait();
    const gasUsed = disputeReceipt.gasUsed * disputeTx.gasPrice;
    const buyerAfter = await ethers.provider.getBalance(buyer.address);

    expect(buyerAfter + gasUsed - buyerBefore).to.equal(PRICE);
  });

  // ── Only buyer can approve ────────────────────────────────────────
  it("reverts if non-buyer tries to approve", async () => {
    await market.connect(seller).registerService("Bot", "x", "http://x", PRICE);
    const tx = await market.connect(buyer).createAgreement(
      seller.address, "Task", { value: PRICE }
    );
    const receipt = await tx.wait();
    const hash = receipt.logs.find(l => l.fragment?.name === "AgreementCreated").args[0];

    await expect(market.connect(seller).approveCompletion(hash))
      .to.be.revertedWith("Not buyer");
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npx hardhat test
```

Expected: All 5 tests PASS (contract is already written — this verifies contract correctness).

**Step 3: Commit**

```bash
git add test/
git commit -m "test: AgentMarketplace - registration, escrow, completion, dispute"
```

---

## Task 4: Deploy to Local Hardhat Network

**Files:**
- Create: `scripts/deploy.js`

**Step 1: Write deploy script**

```js
// scripts/deploy.js
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying from:", deployer.address);

  const Factory = await ethers.getContractFactory("AgentMarketplace");
  const contract = await Factory.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("AgentMarketplace deployed to:", address);

  // Save ABI + address for Python agents
  const artifact = require("../artifacts/contracts/AgentMarketplace.sol/AgentMarketplace.json");
  fs.mkdirSync("abi", { recursive: true });
  fs.writeFileSync("abi/AgentMarketplace.json", JSON.stringify({
    address,
    abi: artifact.abi
  }, null, 2));
  console.log("ABI saved to abi/AgentMarketplace.json");
}

main().catch(e => { console.error(e); process.exit(1); });
```

**Step 2: Start local node in a separate terminal**

```bash
npx hardhat node
```

Expected: `Started HTTP and WebSocket JSON-RPC server at http://127.0.0.1:8545/`
Copy one of the printed private keys for use in simulation.

**Step 3: Deploy**

```bash
npx hardhat run scripts/deploy.js --network localhost
```

Expected:
```
Deploying from: 0xf39F...
AgentMarketplace deployed to: 0x5FbD...
ABI saved to abi/AgentMarketplace.json
```

**Step 4: Update .env**

```
CONTRACT_ADDRESS=<address from above>
```

**Step 5: Commit**

```bash
git add scripts/ abi/
git commit -m "feat: deploy script + ABI export"
```

---

## Task 5: AgentMatcher Service

**Files:**
- Create: `agents/matcher/agent_matcher.py`

**Step 1: Write the matcher**

```python
# agents/matcher/agent_matcher.py
import json, os
from web3 import Web3
from openai import OpenAI
from dotenv import load_dotenv
import numpy as np

load_dotenv()

client   = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
w3       = Web3(Web3.HTTPProvider(os.getenv("RPC_URL", "http://127.0.0.1:8545")))

with open("abi/AgentMarketplace.json") as f:
    meta = json.load(f)

contract = w3.eth.contract(address=meta["address"], abi=meta["abi"])

# In-memory index: {address: {agent_data, embedding}}
_index: dict = {}


def _embed(text: str) -> list[float]:
    resp = client.embeddings.create(model="text-embedding-3-small", input=text)
    return resp.data[0].embedding


def _cosine(a, b) -> float:
    a, b = np.array(a), np.array(b)
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))


def index_registered_agents():
    """Pull all AgentRegistered events and build the local index."""
    events = contract.events.AgentRegistered.get_logs(from_block=0)
    for e in events:
        addr = e["args"]["wallet"]
        agent = contract.functions.agents(addr).call()
        name, capabilities, endpoint, price, reputation, active = agent
        if not active:
            continue
        embedding = _embed(f"{name}: {capabilities}")
        _index[addr] = {
            "address": addr,
            "name": name,
            "capabilities": capabilities,
            "endpoint": endpoint,
            "priceWei": price,
            "reputation": reputation,
            "embedding": embedding,
        }
    print(f"Indexed {len(_index)} agents")


def find_agents(task_description: str, top_k: int = 3) -> list[dict]:
    """Return top_k agents ranked by (embedding similarity + reputation bonus)."""
    if not _index:
        index_registered_agents()

    task_emb = _embed(task_description)
    scored = []
    for addr, data in _index.items():
        sim = _cosine(task_emb, data["embedding"])
        rep_bonus = min(data["reputation"] * 0.01, 0.1)  # up to +0.10
        scored.append((sim + rep_bonus, data))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [d for _, d in scored[:top_k]]


if __name__ == "__main__":
    index_registered_agents()
    results = find_agents("I need to summarize a long research paper")
    for r in results:
        print(f"  {r['name']} ({r['address'][:8]}…) — rep: {r['reputation']}")
```

**Step 2: Write a simple test**

```python
# agents/matcher/test_matcher.py
def test_cosine_similarity():
    from agent_matcher import _cosine
    a = [1.0, 0.0]
    b = [1.0, 0.0]
    assert _cosine(a, b) == 1.0

def test_cosine_orthogonal():
    from agent_matcher import _cosine
    a = [1.0, 0.0]
    b = [0.0, 1.0]
    assert abs(_cosine(a, b)) < 1e-6
```

**Step 3: Run tests**

```bash
cd agents/matcher && python -m pytest test_matcher.py -v
```

Expected: 2 tests PASS

**Step 4: Commit**

```bash
git add agents/matcher/
git commit -m "feat: AgentMatcher - on-chain event indexing + embedding-based discovery"
```

---

## Task 6: Seller Agents (3 FastAPI Services)

**Files:**
- Create: `agents/sellers/summarization_agent.py`
- Create: `agents/sellers/websearch_agent.py`
- Create: `agents/sellers/codereviewer_agent.py`

**Step 1: Write the summarization agent (port 8001)**

```python
# agents/sellers/summarization_agent.py
from fastapi import FastAPI
from pydantic import BaseModel
from openai import OpenAI
import os
from dotenv import load_dotenv

load_dotenv()
app = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
api = FastAPI()

class TaskRequest(BaseModel):
    agreementHash: str
    task: str

@api.post("/execute")
def execute(req: TaskRequest):
    resp = app.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You are a summarization agent. Summarize the given text concisely."},
            {"role": "user", "content": req.task}
        ]
    )
    return {
        "agreementHash": req.agreementHash,
        "output": resp.choices[0].message.content,
        "agent": "SummarizeBot"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(api, host="0.0.0.0", port=8001)
```

**Step 2: Write the web search agent (port 8002)**

```python
# agents/sellers/websearch_agent.py
from fastapi import FastAPI
from pydantic import BaseModel
from openai import OpenAI
import os
from dotenv import load_dotenv

load_dotenv()
app = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
api = FastAPI()

class TaskRequest(BaseModel):
    agreementHash: str
    task: str

@api.post("/execute")
def execute(req: TaskRequest):
    # Simulated search — in production would call a real search API
    resp = app.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You are a web search agent. Simulate realistic web search results for the query."},
            {"role": "user", "content": f"Search query: {req.task}"}
        ]
    )
    return {
        "agreementHash": req.agreementHash,
        "output": resp.choices[0].message.content,
        "agent": "WebSearchBot"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(api, host="0.0.0.0", port=8002)
```

**Step 3: Write the code reviewer agent (port 8003)**

```python
# agents/sellers/codereviewer_agent.py
from fastapi import FastAPI
from pydantic import BaseModel
from openai import OpenAI
import os
from dotenv import load_dotenv

load_dotenv()
app = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
api = FastAPI()

class TaskRequest(BaseModel):
    agreementHash: str
    task: str

@api.post("/execute")
def execute(req: TaskRequest):
    resp = app.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You are a code review agent. Review the provided code for bugs, style issues, and improvements."},
            {"role": "user", "content": req.task}
        ]
    )
    return {
        "agreementHash": req.agreementHash,
        "output": resp.choices[0].message.content,
        "agent": "CodeReviewBot"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(api, host="0.0.0.0", port=8003)
```

**Step 4: Commit**

```bash
git add agents/sellers/
git commit -m "feat: 3 seller agents - summarization, web-search, code-review (FastAPI)"
```

---

## Task 7: Buyer Agent

**Files:**
- Create: `agents/buyer/buyer_agent.py`

**Step 1: Write the buyer agent**

```python
# agents/buyer/buyer_agent.py
import json, os, sys
from web3 import Web3
from openai import OpenAI
import httpx
from dotenv import load_dotenv

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../matcher"))
from agent_matcher import find_agents, index_registered_agents

load_dotenv()

w3     = Web3(Web3.HTTPProvider(os.getenv("RPC_URL", "http://127.0.0.1:8545")))
oai    = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

with open("abi/AgentMarketplace.json") as f:
    meta = json.load(f)

contract = w3.eth.contract(address=meta["address"], abi=meta["abi"])

# Buyer uses Hardhat account #1 (index 1)
BUYER_PRIVATE_KEY = os.getenv("BUYER_PRIVATE_KEY")
buyer_account = w3.eth.account.from_key(BUYER_PRIVATE_KEY)


def run(task_description: str):
    print(f"\n[Buyer] Task: {task_description}")

    # 1. Discover agents
    index_registered_agents()
    matches = find_agents(task_description, top_k=3)
    if not matches:
        print("[Buyer] No agents found.")
        return

    print(f"\n[Buyer] Top matches:")
    for i, m in enumerate(matches):
        print(f"  {i+1}. {m['name']} | rep: {m['reputation']} | {m['priceWei']} wei | {m['capabilities']}")

    # 2. Pick the best match
    best = matches[0]
    print(f"\n[Buyer] Hiring: {best['name']} ({best['address']})")

    # 3. Create on-chain agreement + escrow ETH
    nonce = w3.eth.get_transaction_count(buyer_account.address)
    tx = contract.functions.createAgreement(
        best["address"], task_description
    ).build_transaction({
        "from": buyer_account.address,
        "value": best["priceWei"],
        "nonce": nonce,
        "gas": 300000,
        "gasPrice": w3.to_wei("1", "gwei"),
    })
    signed = buyer_account.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash)

    # Extract agreementHash from event
    logs = contract.events.AgreementCreated().process_receipt(receipt)
    agreement_hash = logs[0]["args"]["agreementHash"].hex()
    print(f"\n[Buyer] Agreement created. Hash: 0x{agreement_hash}")

    # 4. Call seller off-chain
    print(f"\n[Buyer] Calling seller at {best['endpoint']}/execute ...")
    resp = httpx.post(f"{best['endpoint']}/execute", json={
        "agreementHash": f"0x{agreement_hash}",
        "task": task_description
    }, timeout=30)
    result = resp.json()
    print(f"\n[Seller Output]\n{result['output']}")

    # 5. LLM decides whether output is satisfactory
    verdict = oai.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You are a quality inspector. Reply only 'APPROVE' or 'DISPUTE'."},
            {"role": "user", "content": f"Task: {task_description}\n\nOutput: {result['output']}\n\nIs this output satisfactory?"}
        ]
    )
    decision = verdict.choices[0].message.content.strip().upper()
    print(f"\n[Buyer] Quality verdict: {decision}")

    # 6. Approve or dispute on-chain
    hash_bytes = bytes.fromhex(agreement_hash)
    nonce = w3.eth.get_transaction_count(buyer_account.address)

    if "APPROVE" in decision:
        fn = contract.functions.approveCompletion(hash_bytes)
        action = "approveCompletion"
    else:
        fn = contract.functions.raiseDispute(hash_bytes)
        action = "raiseDispute"

    tx = fn.build_transaction({
        "from": buyer_account.address,
        "nonce": nonce,
        "gas": 100000,
        "gasPrice": w3.to_wei("1", "gwei"),
    })
    signed = buyer_account.sign_transaction(tx)
    w3.eth.send_raw_transaction(signed.raw_transaction)
    print(f"\n[Buyer] {action} submitted on-chain. Done.")
```

**Step 2: Commit**

```bash
git add agents/buyer/
git commit -m "feat: buyer agent - LLM-driven discovery, agreement, off-chain call, approval"
```

---

## Task 8: Simulation Runner

**Files:**
- Create: `agents/simulation/run_simulation.py`

**Step 1: Write the registration + simulation script**

```python
# agents/simulation/run_simulation.py
"""
Simulation orchestrator:
1. Registers 3 seller agents on-chain
2. Runs 3 buyer tasks end-to-end
"""
import json, os, sys, time
from web3 import Web3
from dotenv import load_dotenv

load_dotenv()
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

w3 = Web3(Web3.HTTPProvider(os.getenv("RPC_URL", "http://127.0.0.1:8545")))

with open("abi/AgentMarketplace.json") as f:
    meta = json.load(f)
contract = w3.eth.contract(address=meta["address"], abi=meta["abi"])

# Hardhat test accounts (private keys printed by `npx hardhat node`)
ACCOUNTS = [
    os.getenv("SELLER1_PRIVATE_KEY"),
    os.getenv("SELLER2_PRIVATE_KEY"),
    os.getenv("SELLER3_PRIVATE_KEY"),
]

SELLERS = [
    {
        "key": ACCOUNTS[0],
        "name": "SummarizeBot",
        "capabilities": "summarization,text-analysis,document-processing",
        "endpoint": "http://localhost:8001",
        "price": w3.to_wei("0.005", "ether"),
    },
    {
        "key": ACCOUNTS[1],
        "name": "WebSearchBot",
        "capabilities": "web-search,information-retrieval,research",
        "endpoint": "http://localhost:8002",
        "price": w3.to_wei("0.003", "ether"),
    },
    {
        "key": ACCOUNTS[2],
        "name": "CodeReviewBot",
        "capabilities": "code-review,bug-detection,python,javascript",
        "endpoint": "http://localhost:8003",
        "price": w3.to_wei("0.008", "ether"),
    },
]

TASKS = [
    "Summarize the key findings of this machine learning research paper about transformers.",
    "Search the web for the latest news on autonomous AI agents.",
    "Review this Python function for bugs: def add(a,b): return a-b",
]


def register_sellers():
    print("=== Registering Seller Agents ===")
    for s in SELLERS:
        account = w3.eth.account.from_key(s["key"])
        nonce = w3.eth.get_transaction_count(account.address)
        tx = contract.functions.registerService(
            s["name"], s["capabilities"], s["endpoint"], s["price"]
        ).build_transaction({
            "from": account.address,
            "nonce": nonce,
            "gas": 200000,
            "gasPrice": w3.to_wei("1", "gwei"),
        })
        signed = account.sign_transaction(tx)
        w3.eth.send_raw_transaction(signed.raw_transaction)
        print(f"  Registered: {s['name']} at {account.address[:10]}…")
        time.sleep(0.5)
    print()


def run_tasks():
    from buyer.buyer_agent import run
    print("=== Running Buyer Tasks ===")
    for task in TASKS:
        print(f"\n{'='*60}")
        run(task)
        time.sleep(1)


if __name__ == "__main__":
    register_sellers()
    run_tasks()
```

**Step 2: Add seller private keys to .env**

```
SELLER1_PRIVATE_KEY=<hardhat account 2 private key>
SELLER2_PRIVATE_KEY=<hardhat account 3 private key>
SELLER3_PRIVATE_KEY=<hardhat account 4 private key>
BUYER_PRIVATE_KEY=<hardhat account 1 private key>
```

**Step 3: Commit**

```bash
git add agents/simulation/
git commit -m "feat: simulation runner - registers sellers + runs 3 end-to-end buyer tasks"
```

---

## Task 9: Run the Full Simulation

**Step 1: Terminal 1 — Hardhat node**
```bash
cd /Users/ash/Desktop/agentic-marketplace
npx hardhat node
```

**Step 2: Terminal 2 — Deploy contract**
```bash
npx hardhat run scripts/deploy.js --network localhost
# Copy CONTRACT_ADDRESS to .env
```

**Step 3: Terminals 3, 4, 5 — Start seller agents**
```bash
# Terminal 3
python agents/sellers/summarization_agent.py

# Terminal 4
python agents/sellers/websearch_agent.py

# Terminal 5
python agents/sellers/codereviewer_agent.py
```

**Step 4: Terminal 6 — Run simulation**
```bash
cd /Users/ash/Desktop/agentic-marketplace
source venv/bin/activate
python agents/simulation/run_simulation.py
```

**Expected output:**
```
=== Registering Seller Agents ===
  Registered: SummarizeBot at 0x70997…
  Registered: WebSearchBot at 0x3C44C…
  Registered: CodeReviewBot at 0x90F79…

=== Running Buyer Tasks ===
[Buyer] Task: Summarize the key findings...
[Buyer] Top matches:
  1. SummarizeBot | rep: 0 | 5000000000000000 wei | summarization,...
[Buyer] Hiring: SummarizeBot (0x70997...)
[Buyer] Agreement created. Hash: 0xabc123...
[Buyer] Calling seller at http://localhost:8001/execute ...
[Seller Output]
The paper presents...
[Buyer] Quality verdict: APPROVE
[Buyer] approveCompletion submitted on-chain. Done.
```

---

## Task 10: Frontend Dashboard

**Files:**
- Create: `frontend/` (Next.js app)
- Create: `frontend/app/page.tsx` — main dashboard
- Create: `frontend/app/layout.tsx`
- Create: `frontend/components/AgentCard.tsx`
- Create: `frontend/components/AgreementFeed.tsx`
- Create: `frontend/lib/contract.ts`

**Step 1: Bootstrap Next.js app**

```bash
cd /Users/ash/Desktop/agentic-marketplace
npx create-next-app@latest frontend --typescript --tailwind --app --no-src-dir --import-alias "@/*"
cd frontend
npm install ethers
```

**Step 2: Create contract helper**

```ts
// frontend/lib/contract.ts
import { ethers } from "ethers";
import meta from "../../abi/AgentMarketplace.json";

export function getContract() {
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
  return new ethers.Contract(meta.address, meta.abi, provider);
}

export type AgentData = {
  address: string;
  name: string;
  capabilities: string;
  endpoint: string;
  priceWei: bigint;
  reputation: bigint;
  active: boolean;
};

export type AgreementData = {
  agreementHash: string;
  buyer: string;
  seller: string;
  taskDescription: string;
  amountEscrowed: bigint;
  status: number; // 0=PENDING 1=COMPLETED 2=DISPUTED 3=EXPIRED
  createdAt: bigint;
};

export const STATUS_LABELS = ["PENDING", "COMPLETED", "DISPUTED", "EXPIRED"];
export const STATUS_COLORS = ["text-yellow-500", "text-green-500", "text-red-500", "text-gray-400"];
```

**Step 3: Create AgentCard component**

```tsx
// frontend/components/AgentCard.tsx
import type { AgentData } from "@/lib/contract";
import { ethers } from "ethers";

export default function AgentCard({ agent }: { agent: AgentData }) {
  return (
    <div className="border border-gray-700 rounded-xl p-4 bg-gray-900 space-y-1">
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-white text-lg">{agent.name}</h3>
        <span className="text-xs text-gray-400 font-mono">{agent.address.slice(0, 8)}…</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {agent.capabilities.split(",").map(c => (
          <span key={c} className="text-xs bg-blue-900 text-blue-300 rounded px-2 py-0.5">{c.trim()}</span>
        ))}
      </div>
      <div className="flex justify-between text-sm text-gray-300 pt-1">
        <span>Price: <b className="text-white">{ethers.formatEther(agent.priceWei)} ETH</b></span>
        <span>Rep: <b className="text-yellow-400">★ {agent.reputation.toString()}</b></span>
      </div>
    </div>
  );
}
```

**Step 4: Create AgreementFeed component**

```tsx
// frontend/components/AgreementFeed.tsx
import type { AgreementData } from "@/lib/contract";
import { STATUS_LABELS, STATUS_COLORS } from "@/lib/contract";
import { ethers } from "ethers";

export default function AgreementFeed({ agreements }: { agreements: AgreementData[] }) {
  return (
    <div className="space-y-3">
      {agreements.length === 0 && (
        <p className="text-gray-500 text-sm">No agreements yet. Run the simulation to see activity.</p>
      )}
      {agreements.map(ag => (
        <div key={ag.agreementHash} className="border border-gray-700 rounded-xl p-4 bg-gray-900">
          <div className="flex justify-between items-start mb-2">
            <span className="font-mono text-xs text-gray-400">{ag.agreementHash.slice(0, 18)}…</span>
            <span className={`text-xs font-bold ${STATUS_COLORS[ag.status]}`}>
              {STATUS_LABELS[ag.status]}
            </span>
          </div>
          <p className="text-sm text-gray-200 mb-2 italic">"{ag.taskDescription.slice(0, 80)}…"</p>
          <div className="flex justify-between text-xs text-gray-400">
            <span>Buyer: {ag.buyer.slice(0, 10)}…</span>
            <span>Seller: {ag.seller.slice(0, 10)}…</span>
            <span>Escrowed: {ethers.formatEther(ag.amountEscrowed)} ETH</span>
          </div>
        </div>
      ))}
    </div>
  );
}
```

**Step 5: Create main dashboard page**

```tsx
// frontend/app/page.tsx
"use client";
import { useEffect, useState } from "react";
import { getContract, AgentData, AgreementData } from "@/lib/contract";
import AgentCard from "@/components/AgentCard";
import AgreementFeed from "@/components/AgreementFeed";
import { ethers } from "ethers";

export default function Home() {
  const [agents, setAgents] = useState<AgentData[]>([]);
  const [agreements, setAgreements] = useState<AgreementData[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchData() {
    const contract = getContract();

    // Fetch registered agents
    const regLogs = await contract.queryFilter(contract.filters.AgentRegistered());
    const agentList: AgentData[] = await Promise.all(
      regLogs.map(async (log: any) => {
        const addr = log.args.wallet;
        const a = await contract.agents(addr);
        return { address: addr, name: a.name, capabilities: a.capabilities,
                 endpoint: a.endpoint, priceWei: a.priceWei,
                 reputation: a.reputation, active: a.active };
      })
    );
    setAgents(agentList.filter(a => a.active));

    // Fetch agreements
    const agLogs = await contract.queryFilter(contract.filters.AgreementCreated());
    const agreementList: AgreementData[] = await Promise.all(
      agLogs.map(async (log: any) => {
        const h = log.args.agreementHash;
        const ag = await contract.agreements(h);
        return { agreementHash: ethers.hexlify(h), buyer: ag.buyer,
                 seller: ag.seller, taskDescription: ag.taskDescription,
                 amountEscrowed: ag.amountEscrowed, status: Number(ag.status),
                 createdAt: ag.createdAt };
      })
    );
    setAgreements(agreementList.reverse());
    setLoading(false);
  }

  useEffect(() => {
    fetchData();
    // Poll every 3s for live updates
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <main className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-4xl font-bold text-white">AutoCart</h1>
          <p className="text-gray-400 mt-1">Decentralized AI Agent Marketplace · Ethereum</p>
        </div>

        {loading ? (
          <p className="text-gray-400">Connecting to local Hardhat node…</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            {/* Registered Agents */}
            <div>
              <h2 className="text-xl font-semibold mb-4 text-gray-200">
                Registered Agents
                <span className="ml-2 text-sm text-gray-500">({agents.length})</span>
              </h2>
              <div className="space-y-4">
                {agents.map(a => <AgentCard key={a.address} agent={a} />)}
              </div>
            </div>

            {/* Live Agreement Feed */}
            <div>
              <h2 className="text-xl font-semibold mb-4 text-gray-200">
                Live Agreements
                <span className="ml-2 text-sm text-gray-500">({agreements.length})</span>
                <span className="ml-2 text-xs text-green-500 animate-pulse">● live</span>
              </h2>
              <AgreementFeed agreements={agreements} />
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
```

**Step 6: Update layout.tsx title**

```tsx
// frontend/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AutoCart — Agent Marketplace",
  description: "Decentralized AI agent marketplace on Ethereum",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-950">{children}</body>
    </html>
  );
}
```

**Step 7: Run the frontend**

```bash
cd frontend
npm run dev
```

Open: `http://localhost:3000`

Expected: Dark dashboard showing registered agents (name, capabilities, price, reputation) + live agreement feed that auto-refreshes every 3 seconds as the simulation runs.

**Step 8: Commit**

```bash
git add frontend/
git commit -m "feat: Next.js dashboard - live agent registry + agreement feed"
```

---

## Full Demo Flow

```
Terminal 1: npx hardhat node
Terminal 2: npx hardhat run scripts/deploy.js --network localhost
Terminal 3: python agents/sellers/summarization_agent.py
Terminal 4: python agents/sellers/websearch_agent.py
Terminal 5: python agents/sellers/codereviewer_agent.py
Terminal 6: cd frontend && npm run dev          ← open http://localhost:3000
Terminal 7: python agents/simulation/run_simulation.py  ← watch dashboard update live
```

---

## Execution Options

Plan complete and saved to `docs/plans/2026-03-04-agentic-marketplace-implementation.md`.

**Two execution options:**

**1. Subagent-Driven (this session)** — Fresh subagent per task, code review between tasks, fast iteration

**2. Parallel Session (separate)** — Open new session with executing-plans, batch execution with checkpoints

Which approach?
