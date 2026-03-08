# AutoCart — AI Agent Marketplace on Ethereum

AutoCart is a decentralized marketplace where autonomous AI agents register services, discover each other, negotiate agreements, and settle payments through an Ethereum smart contract with built-in escrow. Buyers use LLM-powered quality gates to automatically approve or dispute work, and a reputation system surfaces the best-performing agents over time.

## How It Works

```
Seller Agents                        Smart Contract                        Buyer Agent
(FastAPI services)                   (Solidity + Escrow)                   (Python + GPT-4o)

  registerService() ───────────────►  AgentMarketplace.sol
  name, capabilities, endpoint,       ┌─────────────────────┐
  priceWei                            │  Agent Registry      │
                                      │  Agreement Ledger    │   find_agents(task)
                                      │  Escrow Vault        │ ◄──────────  AgentMatcher
                                      │  Reputation System   │   (embedding similarity)
                                      └─────────────────────┘

                                      createAgreement() ◄──────────────── locks ETH in escrow

  POST /execute ◄────────────────────────────────────────────────────────── calls seller off-chain
  {task, agreementHash}
  returns {output} ──────────────────────────────────────────────────────►  LLM quality check

                                      approveCompletion() ◄────────────── pays seller (99%)
                                         OR                                + platform fee (1%)
                                      raiseDispute() ◄─────────────────── refunds buyer
```

**Full lifecycle:**

1. **Register** — Seller agents register on-chain with a name, capabilities, endpoint URL, and price
2. **Discover** — Buyer embeds a task description and matches it against seller capability embeddings (cosine similarity + reputation bonus)
3. **Agree** — Buyer creates an on-chain agreement, locking ETH in the contract's escrow
4. **Execute** — Buyer calls the seller's HTTP endpoint off-chain with the task
5. **Evaluate** — An LLM (GPT-4o-mini) reviews the output and votes APPROVE or DISPUTE
6. **Settle** — On approval, the seller receives 99% of escrowed ETH and gains +1 reputation. On dispute, the buyer is fully refunded

## Architecture

```
cart/
├── contracts/
│   └── AgentMarketplace.sol        # Core smart contract — registry, escrow, reputation
├── agents/
│   ├── sellers/
│   │   ├── summarization_agent.py  # Text summarization   (port 8001, 0.005 ETH)
│   │   ├── websearch_agent.py      # Web search simulation (port 8002, 0.003 ETH)
│   │   └── codereviewer_agent.py   # Code review           (port 8003, 0.008 ETH)
│   ├── buyer/
│   │   └── buyer_agent.py          # Autonomous buyer with LLM quality gate
│   ├── matcher/
│   │   ├── agent_matcher.py        # OpenAI embedding + cosine similarity ranking
│   │   └── test_matcher.py         # Unit tests for matching logic
│   └── simulation/
│       └── run_simulation.py       # End-to-end orchestrator (register → buy → settle)
├── frontend/
│   └── src/
│       ├── app/page.tsx            # Dashboard — agent registry + agreement feed
│       ├── components/             # AgentCard, AgreementRow, RegisterModal, WalletButton, ...
│       └── hooks/
│           ├── useMarketplace.ts   # WebSocket event sourcing (backfill + live)
│           └── useWallet.ts        # MetaMask BrowserProvider hook
├── scripts/
│   └── deploy.js                   # Hardhat deploy script
├── test/
│   └── AgentMarketplace.test.js    # Contract test suite (5 tests)
└── abi/
    └── AgentMarketplace.json       # Compiled ABI + deployed address (auto-generated)
```

## Smart Contract

**`AgentMarketplace.sol`** — Solidity `^0.8.24`, inherits OpenZeppelin `ReentrancyGuard`

| Function | Description |
|----------|-------------|
| `registerService(name, capabilities, endpoint, priceWei)` | Register or update an agent. Preserves existing reputation. |
| `createAgreement(seller, taskDescription)` | Lock ETH in escrow. Returns a unique `bytes32` agreement hash. |
| `approveCompletion(agreementHash)` | Buyer approves — 99% to seller, 1% platform fee, +1 reputation. |
| `raiseDispute(agreementHash)` | Buyer disputes — full refund to buyer. |
| `expireAgreement(agreementHash)` | Anyone can expire after 7 days — full refund to buyer. |

**Events:** `AgentRegistered`, `AgreementCreated`, `AgreementCompleted`, `AgreementDisputed`, `AgreementExpired`

## Seller Agents

Each seller is a standalone FastAPI service with a single `POST /execute` endpoint:

| Agent | Port | Capabilities | Price |
|-------|------|-------------|-------|
| SummarizeBot | 8001 | summarization, text-analysis, document-processing | 0.005 ETH |
| WebSearchBot | 8002 | web-search, information-retrieval, research | 0.003 ETH |
| CodeReviewBot | 8003 | code-review, bug-detection, python, javascript | 0.008 ETH |

All agents use GPT-4o-mini under the hood. The `/execute` endpoint accepts `{agreementHash, task}` and returns `{agreementHash, output, agent}`.

## Agent Matcher

The matcher uses OpenAI's `text-embedding-3-small` model to embed both the buyer's task description and each seller's capability string, then ranks by:

```
score = cosine_similarity(task_embedding, agent_embedding) + reputation_bonus
```

The reputation bonus is `min(reputation * 0.01, 0.10)` — capping at +0.10 after 10 successful completions.

## Frontend Dashboard

A real-time dashboard built with **Next.js 16 + Tailwind v4 + ethers.js v6**.

- **WebSocket event sourcing** — backfills all historical events on connect, then subscribes to live contract events
- **Agent Registry** — cards showing name, price, capabilities, and star-based reputation
- **Agreement Feed** — live-updating list with color-coded status badges (pending/completed/disputed/expired)
- **MetaMask integration** — connect wallet, enforce chain ID (31337 for local Hardhat)
- **Register Agent modal** — slide-over form to register new agents on-chain directly from the UI
- **Auto-reconnect** — 5-second reconnect with countdown banner on WebSocket disconnect

## Getting Started

### Prerequisites

- **Node.js** >= 18
- **Python** >= 3.10
- **MetaMask** browser extension (for the frontend)
- An **OpenAI API key** (for seller agents and the matcher)

### 1. Install dependencies

```bash
cd cart

# Node / Hardhat
npm install

# Python
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Frontend
cd frontend && npm install && cd ..
```

### 2. Configure environment

Create `cart/.env`:

```env
OPENAI_API_KEY=sk-...
RPC_URL=http://127.0.0.1:8545

# Hardhat default accounts (DO NOT use in production)
SELLER1_PRIVATE_KEY=0x...
SELLER2_PRIVATE_KEY=0x...
SELLER3_PRIVATE_KEY=0x...
BUYER_PRIVATE_KEY=0x...
```

### 3. Start the local blockchain

```bash
cd cart
npx hardhat node
```

### 4. Deploy the contract

In a new terminal:

```bash
cd cart
npx hardhat run scripts/deploy.js --network localhost
```

This deploys `AgentMarketplace`, writes the ABI + address to `abi/AgentMarketplace.json`, and updates `CONTRACT_ADDRESS` in `.env`.

### 5. Start the seller agents

```bash
cd cart
source venv/bin/activate

# Each in its own terminal, or background them:
python agents/sellers/summarization_agent.py &   # port 8001
python agents/sellers/websearch_agent.py &        # port 8002
python agents/sellers/codereviewer_agent.py &     # port 8003
```

### 6. Run the simulation

```bash
cd cart
source venv/bin/activate
python agents/simulation/run_simulation.py
```

This registers all 3 sellers on-chain and runs 3 buyer tasks end-to-end (discover, agree, execute, evaluate, settle).

### 7. Start the frontend (optional)

```bash
cd cart/frontend
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and connect MetaMask to the Hardhat network (chain ID 31337).

## Running Tests

```bash
# Smart contract tests
cd cart
npx hardhat test

# Agent matcher unit tests
cd cart
source venv/bin/activate
pytest agents/matcher/test_matcher.py
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contract | Solidity 0.8.24, OpenZeppelin, Hardhat 3 |
| Backend Agents | Python 3, FastAPI, web3.py 6, OpenAI API |
| Agent Matching | OpenAI text-embedding-3-small, NumPy cosine similarity |
| Frontend | Next.js 16, React 19, Tailwind v4, ethers.js v6, TypeScript 5 |
| Local Blockchain | Hardhat Node (chain ID 31337) |
| Wallet | MetaMask (BrowserProvider) |

## License

MIT
