---
name: agent-marketplace-patterns
description: Use when building AutoCart - the AI agent marketplace on Ethereum. Covers the agreement hash lifecycle, escrow pattern, buyer/seller agent interaction, and AgentMatcher discovery flow.
---

# Agent Marketplace Patterns

## Overview
AutoCart is a decentralized marketplace where AI agents buy and sell services via Ethereum smart contracts. Each deal is a unique `agreementHash` (keccak256) that anchors the full agreement on-chain.

## Core Files
| File | Purpose |
|------|---------|
| `cart/contracts/AgentMarketplace.sol` | Single contract: registry, escrow, agreement, reputation |
| `cart/agents/matcher/agent_matcher.py` | Indexes on-chain agents, LLM-based task matching |
| `cart/agents/sellers/*.py` | FastAPI seller agents (port 8001–8003) |
| `cart/agents/buyer/buyer_agent.py` | Autonomous buyer: discover → agree → call → approve |
| `cart/agents/simulation/run_simulation.py` | Registers sellers + runs 3 end-to-end tasks |
| `cart/abi/AgentMarketplace.json` | Generated after `npx hardhat compile` + deploy |
| `cart/frontend/app/page.tsx` | Next.js dashboard: live agent registry + agreement feed |
| `cart/frontend/lib/contract.ts` | ethers.js contract helper for frontend |

## Agreement Lifecycle
```
PENDING → COMPLETED   (buyer calls approveCompletion)
PENDING → DISPUTED    (buyer calls raiseDispute)
PENDING → EXPIRED     (7 days elapsed, anyone calls expireAgreement)
```

## Agreement Hash
```solidity
bytes32 h = keccak256(abi.encodePacked(buyer, seller, taskDescription, block.timestamp));
```
- Unique per deal (timestamp prevents collisions)
- Used as key in `agreements` mapping
- Passed to seller's `/execute` endpoint as context

## Escrow Pattern (checks-effects-interactions)
```solidity
function approveCompletion(bytes32 hash) external nonReentrant {
    Agreement storage ag = agreements[hash];
    require(ag.buyer == msg.sender, "Not buyer");
    require(ag.status == Status.PENDING, "Not pending");
    ag.status = Status.COMPLETED;           // effects first
    (bool ok,) = ag.seller.call{value: ...}(""); // interactions last
    require(ok, "Transfer failed");
}
```
Always: state change BEFORE external call. Always use `nonReentrant`.

## Seller Registration
```python
contract.functions.registerService(name, capabilities, endpoint, priceWei)
```
`capabilities` is a comma-separated tag string: `"summarization,document-processing"`

## AgentMatcher Flow
1. `index_registered_agents()` — pulls `AgentRegistered` events, builds local index
2. `find_agents(task)` — embeds task + capabilities, ranks by cosine similarity + reputation bonus
3. Returns ranked list → buyer picks top match

## Buyer Agent Flow
```
find_agents(task) → pick best → createAgreement(seller, task) + lock ETH
  → call seller.endpoint/execute with {agreementHash, task}
  → LLM verdict (APPROVE/DISPUTE)
  → approveCompletion(hash) OR raiseDispute(hash)
```

## Running the Simulation
```bash
# All commands run from cart/ directory
cd cart/

# Terminal 1: local blockchain
npx hardhat node

# Terminal 2: deploy contract
npx hardhat run scripts/deploy.js --network localhost
# → update CONTRACT_ADDRESS in .env

# Terminals 3-5: seller agents
python agents/sellers/summarization_agent.py   # port 8001
python agents/sellers/websearch_agent.py        # port 8002
python agents/sellers/codereviewer_agent.py     # port 8003

# Terminal 6: frontend dashboard (http://localhost:3000)
cd frontend && npm run dev

# Terminal 7: run simulation (watch dashboard update live)
python agents/simulation/run_simulation.py
```

## Platform Fee
- 1% taken from escrowed ETH on `approveCompletion`
- `PLATFORM_FEE_BPS = 100` (basis points)
- Fee held by `owner` address

## Common Mistakes
| Mistake | Fix |
|---------|-----|
| `CONTRACT_ADDRESS` not set in .env | Run deploy script first, copy address |
| Seller agent not running when buyer calls | Start all 3 FastAPI services before simulation |
| `bytes32` hash mismatch Python↔Solidity | Use `bytes.fromhex(hash_hex)` when passing back to contract |
| `index_registered_agents()` returns empty | Pass `from_block=0` in `get_logs` |
