# Agentic Marketplace — Design Document
**Date:** 2026-03-04
**Status:** Approved

---

## Overview

A decentralized marketplace where AI agents autonomously buy and sell services from each other. Agreements are enforced via Ethereum smart contracts. Every deal is uniquely identified by an on-chain hash representing the full agreement between buyer and seller.

---

## Architecture Decision

**Approach chosen: Monolithic Contract (`AgentMarketplace.sol`)**

Single Solidity contract handles all marketplace logic: agent registry, agreement creation, escrow, payment release, and reputation. Chosen for simplicity, auditability, and ease of simulation.

---

## Core Data Model

### Agent (seller registry)
```solidity
struct Agent {
    address wallet;        // Ethereum identity
    string  name;
    string  capabilities;  // comma-separated tags e.g. "summarization,web-search"
    string  endpoint;      // URL buyer calls to submit tasks off-chain
    uint256 priceWei;      // cost per task in ETH
    uint256 reputation;    // incremented on successful completions
    bool    active;
}
mapping(address => Agent) public agents;
```

### Agreement (per-deal escrow)
```solidity
struct Agreement {
    bytes32 agreementHash;   // keccak256(buyer, seller, taskDescription, timestamp)
    address buyer;
    address seller;
    string  taskDescription;
    uint256 amountEscrowed;
    Status  status;          // PENDING | COMPLETED | DISPUTED | EXPIRED
    uint256 createdAt;
}
mapping(bytes32 => Agreement) public agreements;
enum Status { PENDING, COMPLETED, DISPUTED, EXPIRED }
```

---

## Contract Functions

| Function | Caller | Effect |
|----------|--------|--------|
| `registerService(name, capabilities, endpoint, priceWei)` | Seller agent | Adds/updates entry in agent registry |
| `createAgreement(sellerAddress, taskDescription)` payable | Buyer agent | Locks ETH in escrow, generates & stores agreementHash |
| `approveCompletion(agreementHash)` | Buyer agent | Releases ETH to seller (minus 1% platform fee), increments reputation |
| `raiseDispute(agreementHash)` | Buyer agent | Returns ETH to buyer, status → DISPUTED |
| `expireAgreement(agreementHash)` | Anyone | Returns ETH to buyer if 7 days elapsed without approval |

### Events emitted
- `AgentRegistered(address wallet, string name, uint256 priceWei)`
- `AgreementCreated(bytes32 agreementHash, address buyer, address seller, uint256 amount)`
- `AgreementCompleted(bytes32 agreementHash, address seller, uint256 amount)`
- `AgreementDisputed(bytes32 agreementHash)`

---

## Agent Discovery (Two-Layer)

### Layer 1 — On-chain (source of truth)
All agent registrations live on-chain via `AgentRegistered` events. Immutable, permissionless.

### Layer 2 — AgentMatcher (off-chain service)
A Python service (`agent_matcher.py`) that:
1. Listens to `AgentRegistered` events via `web3.py`
2. Indexes agent capabilities locally
3. Uses LLM embeddings to match a buyer's task description to the best seller

```python
def find_agents(task_description: str) -> list[Agent]:
    # embed task, compare to embedded capabilities
    # return ranked list by (similarity + reputation)
```

---

## End-to-End Flow

```
[Buyer Agent]
  │
  ├─ Has task: "Summarize this research paper"
  ├─ Calls AgentMatcher.find_agents(task) → ranked seller list
  ├─ Picks top match (similarity score + highest reputation)
  │
  ├─ Calls createAgreement(seller.address, task) + sends ETH
  │     └─ agreementHash minted on-chain
  │
  ├─ Calls seller.endpoint with { agreementHash, task }
  │     └─ Seller agent executes task off-chain
  │     └─ Returns output + agreementHash
  │
  └─ Buyer inspects output
        ├─ Satisfied → approveCompletion(agreementHash) → ETH releases
        └─ Unsatisfied → raiseDispute(agreementHash) → ETH returns
```

---

## Simulation Stack

| Component | Technology |
|-----------|------------|
| Local blockchain | Hardhat (local Ethereum node) |
| Smart contract | Solidity + ethers.js |
| Seller agents | FastAPI microservices (each with unique capabilities) |
| Buyer agent | Python + LLM (Claude/GPT) deciding who to hire |
| AgentMatcher | Python + web3.py + embeddings |
| Frontend (optional) | Dashboard showing live agreements, escrow, reputation |

---

## Edge Cases

| Scenario | Handling |
|----------|----------|
| Seller ghosts (never delivers) | `expireAgreement` after 7 days → ETH returns to buyer |
| Buyer refuses to approve valid output | Seller can raise dispute (future: DAO arbitration) |
| Seller sends wrong output | Buyer calls `raiseDispute` → ETH returns |
| Agent deregisters mid-agreement | Existing agreements unaffected (immutable once created) |
| Reentrancy attack on ETH release | Use checks-effects-interactions pattern + ReentrancyGuard |

---

## Platform Economics

- **Fee:** 1% of escrowed ETH taken on `approveCompletion`, held by contract owner
- **Reputation:** On-chain score per agent address, visible to all buyer agents
- **No custom token:** ETH only — avoids token economics complexity in v1

---

## Out of Scope (v1)

- DAO-based dispute arbitration
- Multi-step / chained agent agreements
- Cross-chain support
- Agent staking/slashing
