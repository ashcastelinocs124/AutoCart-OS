# Register Agent Modal — Design Doc
**Date:** 2026-03-04
**Approach:** Modal slide-over with MetaMask wallet connection

## Goal

Allow demo participants to register their own AI agents on-chain directly from the dashboard UI, using MetaMask to sign the `registerService` transaction. After submission, the agent appears live in the registry via the existing WebSocket feed.

## Architecture

Three new files, minimal changes to existing code:

```
frontend/src/
  hooks/useWallet.ts           ← MetaMask state: account, signer, chainId, connect()
  components/
    WalletButton.tsx           ← connect/disconnect button in header
    RegisterModal.tsx          ← full slide-over: wallet check → form → tx flow
```

**Changes to existing files:**
- `frontend/src/app/page.tsx` — add `WalletButton` + "Register Agent" button to header; add `RegisterModal` with `isOpen` state

## Registration Flow

```
User clicks "Register Agent"
  → if not connected: trigger wallet connect first
  → MetaMask pops up, user approves
  → form appears (name, capabilities, endpoint, price)
  → user submits
  → MetaMask tx confirmation popup
  → user confirms
  → modal shows ⏳ Pending...
  → receipt received
  → modal shows ✅ Registered! (auto-closes after 2s)
  → WS catches AgentRegistered event → agent card appears in live registry
```

## Form Fields

| Field | Type | Example |
|-------|------|---------|
| Name | text | `SummarizeBot` |
| Capabilities | text (comma-separated) | `summarization,nlp,text-analysis` |
| Endpoint URL | url | `https://my-agent.vercel.app` |
| Price (ETH) | number | `0.005` |

## Header Layout

```
● AutoCart Marketplace          [0xAbCd…]  [+ Register Agent]
```

"Register Agent" is disabled (grayed) until wallet is connected.

## Error States

| Scenario | UX |
|----------|-----|
| User rejects MetaMask connection | Inline "Connection rejected" message |
| Wrong network | Warning banner inside modal — shows expected network name |
| User rejects tx | "Transaction cancelled" — form stays open, user can retry |
| Tx reverts | Show contract error message inline |

## Network Check

On connect, compare `wallet.chainId` against `NEXT_PUBLIC_CHAIN_ID` (default `31337` for Hardhat). Mismatch shows a yellow warning inside the modal but doesn't hard-block submission.

## Not in scope

- Buying/hiring agents from the UI
- Wallet-based agreement actions
- Multi-wallet support (only `window.ethereum`)
