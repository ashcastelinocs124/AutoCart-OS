# AutoCart — AI Agent Marketplace on Ethereum

## Skills — When to Use What

### AutoCart-Specific Skills (live in `cart/.claude/skills/` — only active when working in cart/)

| Trigger | Skill |
|---------|-------|
| Adding/modifying smart contract, escrow logic, agreement lifecycle | `/agent-marketplace-patterns` |
| Compiling Solidity, running Hardhat node, deploy scripts, contract tests | `/hardhat-workflow` |
| Python agent calling contract, sending txns, reading events, signing | `/web3py-integration` |

### General Skills

| Trigger | Skill |
|---------|-------|
| Implement feature, add agent, write code | `/code-implementation` |
| Bug, error, stack trace, test failure | `/bug-fix` |
| Architecture decision, "should we use X pattern" | `/system-arch` |
| Feature/design brainstorm before coding | `/superpowers:brainstorming` |
| Multi-step plan to execute | `/superpowers:writing-plans` |
| Push to GitHub | `/gitpush` |
| Code review requested | `/code-reviewer` |

## Sub-Agents — Available in `.claude/agents/`

These are invoked automatically by skills via the Task tool. You can also invoke them directly.

| Agent | When it runs |
|-------|-------------|
| `code-implementation` | Writing new agent services, contract functions, or frontend components |
| `code-reviewer` | After any implementation step completes — validates against plan + conventions |
| `root-cause-hunter` | Python agent crashes, contract reverts, web3.py errors, simulation failures |
| `integration-test-validator` | After code review passes — runs full test suite and validates end-to-end |
| `system-arch` | Designing new agent types, new contract functions, or marketplace patterns |
| `tutor` | Explaining contract mechanics, agent flows, or web3.py patterns on request |

### How Skills Chain to Agents

```
/code-implementation
  └── explores codebase
  └── presents plan → user approves
  └── implements → dispatches code-implementation agent for heavy subtasks
  └── calls code-reviewer agent automatically on completion
  └── calls integration-test-validator agent after review passes

/bug-fix
  └── dispatches root-cause-hunter agent to reproduce + isolate
  └── proposes minimal fix → implements
  └── calls code-reviewer agent to verify fix

/agent-marketplace-patterns
  └── loads agreement lifecycle, escrow pattern, AgentMatcher flow
  └── guides implementation without spawning agents (reference skill)

/hardhat-workflow + /web3py-integration
  └── reference skills — provide patterns, not agents
  └── used inside code-implementation or bug-fix flows
```

## Learnings

This project maintains a `learnings.md` file at the project root. Add entries whenever you:
- Fix a non-obvious bug (include root cause)
- Discover a library/API gotcha or version-specific quirk
- Make an architectural decision worth remembering
- Find a useful command, config, or file path that wasn't obvious

Use the `/capture-learnings` skill at the end of sessions to do this automatically.

## Completed Work

### Project Layout

All project source lives under `cart/`. The root `.claude/` is the **global** config. The project-specific `.claude/` lives inside `cart/`.

```
AutoCart/
  .claude/          ← GLOBAL skills & agents (available to all projects)
    skills/         ← code-implementation, gitpush, bug-fix, system-arch, ...
    agents/         ← code-implementation, code-reviewer, root-cause-hunter, ...
  CLAUDE.md         ← this file (global context)
  cart/
    .claude/        ← PROJECT skills (AutoCart-specific only)
      skills/       ← agent-marketplace-patterns, hardhat-workflow, web3py-integration
    contracts/      ← AgentMarketplace.sol
    agents/         ← buyer, seller, matcher, simulation Python agents
    frontend/       ← Next.js dashboard
    abi/            ← compiled ABI + deployed address
    scripts/        ← Hardhat deploy scripts
    test/           ← contract tests
    .env            ← local credentials (never commit)
```

### Smart Contract + Python Agents (Tasks 1–8)
- `cart/contracts/AgentMarketplace.sol` — registry + escrow contract with 5 events, ReentrancyGuard, reputation system
- Seller agents: `cart/agents/sellers/` — summarization (8001), websearch (8002), codereviewer (8003) FastAPI services
- Buyer agent: `cart/agents/buyer/buyer_agent.py` — LLM-driven discover → agree → call → approve/dispute
- AgentMatcher: `cart/agents/matcher/agent_matcher.py` — cosine similarity on OpenAI embeddings
- Simulation: `cart/agents/simulation/run_simulation.py` — registers sellers + runs 3 buyer tasks end-to-end

### Register Agent Modal
- `useWallet.ts` — MetaMask BrowserProvider, `WalletState` type, connect/disconnect
- `WalletButton.tsx` — shows truncated address or "Connect Wallet"
- `RegisterModal.tsx` — slide-over: wallet gate → form → `registerService` tx → live update
- `openModal` opens unconditionally; modal handles auth internally (avoid race condition)
- Wrap `onClose` in `useCallback` in page.tsx (prevents auto-close timer resetting)

### Frontend Dashboard (Task 10)
- Next.js 16 + Tailwind v4 + ethers.js v6 in `cart/frontend/`
- WebSocket event sourcing — backfills history then subscribes live to all 5 contract events
- Two-panel: Agent Registry (sorted by reputation) + Agreement Feed (sorted by createdAt desc)
- Status badges: PENDING=yellow, COMPLETED=green, DISPUTED=red, EXPIRED=gray
- ConnectionBanner with 5s reconnect on WS disconnect

## Key Conventions
- web3.py: `signed.rawTransaction` (not `raw_transaction`), `get_logs(fromBlock=0)` (not `from_block`)
- Gas for approve/dispute txns: 300000
- Tailwind v4: `@import "tailwindcss"` (not `@tailwind base/components/utilities`)
- ethers.js v6 WebSocket: `provider.websocket as unknown as WebSocket`
