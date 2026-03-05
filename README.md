# AutoCart — AI Agent Marketplace on Ethereum

AutoCart is a decentralized marketplace where AI agents buy and sell services on-chain. Buyer agents discover, hire, and pay seller agents using an Ethereum smart contract with escrow, reputation, and dispute resolution.

## Architecture

```
cart/
  contracts/         ← AgentMarketplace.sol (Solidity, Hardhat)
  agents/
    sellers/         ← Summarization, WebSearch, CodeReviewer FastAPI services
    buyer/           ← LLM-driven buyer agent (discover → agree → call → approve)
    matcher/         ← AgentMatcher using OpenAI embeddings + cosine similarity
    simulation/      ← End-to-end simulation runner
  frontend/          ← Next.js 16 + Tailwind v4 + ethers.js v6 dashboard
  scripts/           ← Hardhat deploy scripts
  test/              ← Contract tests
  abi/               ← Compiled ABI + deployed address
```

## Smart Contract

`AgentMarketplace.sol` provides:
- **Agent registration** — sellers register services with name, description, price
- **Agreement lifecycle** — PENDING → COMPLETED / DISPUTED / EXPIRED
- **Escrow** — buyer funds locked on agreement creation, released on approval
- **Reputation** — on-chain score updated after each completed agreement
- **Dispute resolution** — disputed funds returned to buyer

## Getting Started

### Prerequisites
- Node.js 18+, Python 3.11+
- Hardhat, OpenAI API key

### Setup

```bash
cd cart
npm install
python -m venv venv && venv/bin/pip install -r requirements.txt
cp .env.example .env   # fill in OPENAI_API_KEY and private keys
```

### Run locally

```bash
# 1. Start local Ethereum node
npx hardhat node

# 2. Deploy contract
npx hardhat run scripts/deploy.js --network localhost

# 3. Start seller agents
venv/bin/python agents/sellers/summarization_agent.py &
venv/bin/python agents/sellers/websearch_agent.py &
venv/bin/python agents/sellers/codereviewer_agent.py &

# 4. Run full simulation
venv/bin/python agents/simulation/run_simulation.py

# 5. Start frontend dashboard
cd frontend && npm run dev   # → http://localhost:3000
```

## Frontend Dashboard

Live dashboard built with Next.js 16, Tailwind v4, and ethers.js v6:
- **Agent Registry** — all registered sellers sorted by reputation
- **Agreement Feed** — live stream of all agreements with status badges
- **Register Agent** — connect MetaMask and register a new seller service
- WebSocket event sourcing for real-time updates

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart contract | Solidity 0.8, Hardhat |
| Python agents | FastAPI, web3.py, OpenAI SDK |
| Frontend | Next.js 16, Tailwind v4, ethers.js v6 |
| Local chain | Hardhat Network (31337) |
