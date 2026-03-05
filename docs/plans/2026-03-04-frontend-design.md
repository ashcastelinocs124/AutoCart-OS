# AutoCart Frontend Dashboard — Design Doc
**Date:** 2026-03-04
**Approach:** Event-sourced WebSocket dashboard (Next.js + ethers.js)

## Architecture

Next.js (TypeScript, App Router) in `frontend/`. A single custom hook `useMarketplace` manages the ethers.js `WebSocketProvider` connected to `ws://localhost:8545`. On mount it backfills history via `contract.queryFilter(...)` for each event type, then subscribes live with `contract.on(...)`. State is plain React `useState`.

```
frontend/
  src/
    app/page.tsx            ← dashboard layout (two-panel)
    hooks/useMarketplace.ts ← WS provider + event state
    components/
      AgentCard.tsx         ← name, capabilities, price, reputation
      AgreementRow.tsx      ← hash, buyer→seller, task preview, amount, status
      StatusBadge.tsx       ← PENDING/COMPLETED/DISPUTED/EXPIRED colored chip
      ConnectionBanner.tsx  ← red banner on WS disconnect with reconnect countdown
  .env.local                ← NEXT_PUBLIC_CONTRACT_ADDRESS, NEXT_PUBLIC_RPC_WS_URL
```

## Data Flow

1. `useMarketplace` opens `WebSocketProvider → ws://localhost:8545`
2. Backfills via `queryFilter(AgentRegistered, 0, "latest")` + all Agreement events
3. Subscribes: `contract.on("AgentRegistered", ...)`, `contract.on("AgreementCreated", ...)`, `contract.on("AgreementCompleted", ...)`, `contract.on("AgreementDisputed", ...)`
4. New events prepend to state arrays → components re-render instantly

## Components

| Component | Responsibility |
|-----------|---------------|
| `AgentRegistry` | Card grid — name, capability tags, price in ETH, reputation star count |
| `AgreementFeed` | Scrollable list — truncated hash, buyer→seller, task preview, escrowed ETH, status badge |
| `StatusBadge` | Colored chip: PENDING=yellow, COMPLETED=green, DISPUTED=red, EXPIRED=gray |
| `ConnectionBanner` | Red banner when WS disconnects; auto-reconnect every 5s with countdown |

## Error Handling

- WebSocket drop → `ConnectionBanner` with reconnect countdown, auto-retry every 5s
- Contract read failure → inline "Failed to load" with retry button
- No silent failures

## Environment

```
NEXT_PUBLIC_CONTRACT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
NEXT_PUBLIC_RPC_WS_URL=ws://localhost:8545
```

## Not in scope

- Wallet connection / MetaMask
- Sending transactions from the UI
- Authentication
