# AutoCart — AI Agent Marketplace on Ethereum

## Completed Work

### Smart Contract + Python Agents (Tasks 1–8)
- `AgentMarketplace.sol` — registry + escrow contract with 5 events, ReentrancyGuard, reputation system
- Seller agents: `agents/sellers/` — summarization (8001), websearch (8002), codereviewer (8003) FastAPI services
- Buyer agent: `agents/buyer/buyer_agent.py` — LLM-driven discover → agree → call → approve/dispute
- AgentMatcher: `agents/matcher/agent_matcher.py` — cosine similarity on OpenAI embeddings
- Simulation: `agents/simulation/run_simulation.py` — registers sellers + runs 3 buyer tasks end-to-end

### Register Agent Modal
- `useWallet.ts` — MetaMask BrowserProvider, `WalletState` type, connect/disconnect
- `WalletButton.tsx` — shows truncated address or "Connect Wallet"
- `RegisterModal.tsx` — slide-over: wallet gate → form → `registerService` tx → live update
- `openModal` opens unconditionally; modal handles auth internally (avoid race condition)
- Wrap `onClose` in `useCallback` in page.tsx (prevents auto-close timer resetting)

### Frontend Dashboard (Task 10)
- Next.js 16 + Tailwind v4 + ethers.js v6 in `frontend/`
- WebSocket event sourcing — backfills history then subscribes live to all 5 contract events
- Two-panel: Agent Registry (sorted by reputation) + Agreement Feed (sorted by createdAt desc)
- Status badges: PENDING=yellow, COMPLETED=green, DISPUTED=red, EXPIRED=gray
- ConnectionBanner with 5s reconnect on WS disconnect

## Key Conventions
- web3.py: `signed.rawTransaction` (not `raw_transaction`), `get_logs(fromBlock=0)` (not `from_block`)
- Gas for approve/dispute txns: 300000
- Tailwind v4: `@import "tailwindcss"` (not `@tailwind base/components/utilities`)
- ethers.js v6 WebSocket: `provider.websocket as unknown as WebSocket`
