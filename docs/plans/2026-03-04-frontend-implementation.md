# AutoCart Frontend Dashboard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Next.js dashboard that shows live agent registry and agreement feed by subscribing to on-chain events over WebSocket.

**Architecture:** Next.js (App Router, TypeScript, Tailwind) in `frontend/`. A `useMarketplace` hook opens a WebSocket ethers provider, backfills historical events via `queryFilter`, then subscribes live with `contract.on(...)`. State is plain React `useState` — no Redux. Components are pure presentational.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, ethers.js v6, Hardhat local node (`ws://localhost:8545`)

---

### Task 1: Scaffold Next.js app

**Files:**
- Create: `frontend/` (entire directory via create-next-app)

**Step 1: Scaffold from project root**

```bash
cd /Users/ash/Desktop/AutoCart
npx create-next-app@latest frontend \
  --typescript \
  --tailwind \
  --app \
  --src-dir \
  --no-eslint \
  --import-alias "@/*" \
  --no-turbopack
```

When prompted "Would you like to use...?" — answer defaults (all yes/no as they appear). If it prompts interactively, run: `echo "y" | npx create-next-app@latest frontend --typescript --tailwind --app --src-dir --no-eslint --import-alias "@/*"`.

**Step 2: Install ethers.js**

```bash
cd /Users/ash/Desktop/AutoCart/frontend
npm install ethers
```

**Step 3: Verify scaffold works**

```bash
cd /Users/ash/Desktop/AutoCart/frontend
npm run build 2>&1 | tail -5
```

Expected: `✓ Compiled successfully` (or similar). No errors.

**Step 4: Commit**

```bash
cd /Users/ash/Desktop/AutoCart
git add frontend/
git commit -m "feat: scaffold Next.js frontend with Tailwind + ethers"
```

---

### Task 2: Set up ABI, env, and types

**Files:**
- Create: `frontend/src/lib/abi.ts`
- Create: `frontend/.env.local`
- Create: `frontend/src/types/marketplace.ts`

**Step 1: Create `.env.local`**

```
# frontend/.env.local
NEXT_PUBLIC_CONTRACT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
NEXT_PUBLIC_RPC_WS_URL=ws://localhost:8545
```

**Step 2: Create `frontend/src/lib/abi.ts`**

Read `abi/AgentMarketplace.json` (at project root). Copy only the `abi` array into this file:

```typescript
// frontend/src/lib/abi.ts
const ABI = [
  // paste the full contents of the "abi" array from /Users/ash/Desktop/AutoCart/abi/AgentMarketplace.json here
] as const

export default ABI
```

To get the content: `cat /Users/ash/Desktop/AutoCart/abi/AgentMarketplace.json | python3 -c "import json,sys; print(json.dumps(json.load(sys.stdin)['abi'], indent=2))"`

**Step 3: Create `frontend/src/types/marketplace.ts`**

```typescript
// frontend/src/types/marketplace.ts

export type AgentStatus = 'PENDING' | 'COMPLETED' | 'DISPUTED' | 'EXPIRED'

export type Agent = {
  address: string
  name: string
  capabilities: string[]
  priceEth: string
  reputation: number
}

export type Agreement = {
  hash: string
  buyer: string
  seller: string
  sellerName: string
  taskDescription: string
  amountEth: string
  status: AgentStatus
  createdAt: number
}
```

**Step 4: Commit**

```bash
cd /Users/ash/Desktop/AutoCart
git add frontend/src/lib/abi.ts frontend/src/types/marketplace.ts
git commit -m "feat: add ABI, env, and marketplace types"
# Note: .env.local is gitignored by default — do not force-add it
```

---

### Task 3: Build `useMarketplace` hook

**Files:**
- Create: `frontend/src/hooks/useMarketplace.ts`

**Step 1: Write the hook**

```typescript
// frontend/src/hooks/useMarketplace.ts
'use client'

import { useEffect, useState } from 'react'
import { ethers } from 'ethers'
import ABI from '@/lib/abi'
import type { Agent, Agreement, AgentStatus } from '@/types/marketplace'

const STATUS_MAP: AgentStatus[] = ['PENDING', 'COMPLETED', 'DISPUTED', 'EXPIRED']

export function useMarketplace() {
  const [agents, setAgents] = useState<Record<string, Agent>>({})
  const [agreements, setAgreements] = useState<Record<string, Agreement>>({})
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_RPC_WS_URL!
    const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS!

    let provider: ethers.WebSocketProvider
    let contract: ethers.Contract
    let reconnectTimer: ReturnType<typeof setTimeout>

    async function connect() {
      try {
        provider = new ethers.WebSocketProvider(wsUrl)
        contract = new ethers.Contract(contractAddress, ABI, provider)

        // Connection state
        provider.websocket.addEventListener('open', () => setConnected(true))
        provider.websocket.addEventListener('close', () => {
          setConnected(false)
          reconnectTimer = setTimeout(connect, 5000)
        })

        // ── Backfill ──────────────────────────────────────────────────────────

        // 1. Agents — build map first so agreements can resolve seller names
        const agentMap: Record<string, Agent> = {}
        const agentEvents = await contract.queryFilter(contract.filters.AgentRegistered())
        for (const e of agentEvents) {
          const log = e as ethers.EventLog
          const addr: string = log.args.wallet
          const raw = await contract.agents(addr)
          agentMap[addr] = {
            address: addr,
            name: raw.name,
            capabilities: (raw.capabilities as string).split(',').map((s) => s.trim()),
            priceEth: ethers.formatEther(raw.priceWei),
            reputation: Number(raw.reputation),
          }
        }
        setAgents(agentMap)

        // 2. Agreements — read current status from chain (handles disputes/completions)
        const agreementMap: Record<string, Agreement> = {}
        const agreementEvents = await contract.queryFilter(contract.filters.AgreementCreated())
        for (const e of agreementEvents) {
          const log = e as ethers.EventLog
          const hash: string = log.args.agreementHash
          const raw = await contract.agreements(hash)
          agreementMap[hash] = {
            hash,
            buyer: raw.buyer,
            seller: raw.seller,
            sellerName: agentMap[raw.seller]?.name ?? raw.seller.slice(0, 8) + '…',
            taskDescription: raw.taskDescription,
            amountEth: ethers.formatEther(raw.amountEscrowed),
            status: STATUS_MAP[Number(raw.status)],
            createdAt: Number(raw.createdAt),
          }
        }
        setAgreements(agreementMap)

        // ── Live subscriptions ────────────────────────────────────────────────

        contract.on('AgentRegistered', async (wallet: string) => {
          const raw = await contract.agents(wallet)
          setAgents((prev) => ({
            ...prev,
            [wallet]: {
              address: wallet,
              name: raw.name,
              capabilities: (raw.capabilities as string).split(',').map((s: string) => s.trim()),
              priceEth: ethers.formatEther(raw.priceWei),
              reputation: Number(raw.reputation),
            },
          }))
        })

        contract.on('AgreementCreated', async (hash: string, buyer: string, seller: string) => {
          const raw = await contract.agreements(hash)
          setAgents((prevAgents) => {
            setAgreements((prev) => ({
              ...prev,
              [hash]: {
                hash,
                buyer,
                seller,
                sellerName: prevAgents[seller]?.name ?? seller.slice(0, 8) + '…',
                taskDescription: raw.taskDescription,
                amountEth: ethers.formatEther(raw.amountEscrowed),
                status: 'PENDING',
                createdAt: Number(raw.createdAt),
              },
            }))
            return prevAgents
          })
        })

        contract.on('AgreementCompleted', (hash: string) => {
          setAgreements((prev) =>
            prev[hash] ? { ...prev, [hash]: { ...prev[hash], status: 'COMPLETED' } } : prev
          )
        })

        contract.on('AgreementDisputed', (hash: string) => {
          setAgreements((prev) =>
            prev[hash] ? { ...prev, [hash]: { ...prev[hash], status: 'DISPUTED' } } : prev
          )
        })

        contract.on('AgreementExpired', (hash: string) => {
          setAgreements((prev) =>
            prev[hash] ? { ...prev, [hash]: { ...prev[hash], status: 'EXPIRED' } } : prev
          )
        })
      } catch (err) {
        console.error('[useMarketplace] connect error:', err)
        reconnectTimer = setTimeout(connect, 5000)
      }
    }

    connect()

    return () => {
      clearTimeout(reconnectTimer)
      contract?.removeAllListeners?.()
      provider?.destroy?.()
    }
  }, [])

  const agentList = Object.values(agents).sort((a, b) => b.reputation - a.reputation)
  const agreementList = Object.values(agreements).sort((a, b) => b.createdAt - a.createdAt)

  return { agents: agentList, agreements: agreementList, connected }
}
```

**Step 2: Commit**

```bash
cd /Users/ash/Desktop/AutoCart
git add frontend/src/hooks/useMarketplace.ts
git commit -m "feat: add useMarketplace hook with WS event sourcing"
```

---

### Task 4: Build `StatusBadge` component

**Files:**
- Create: `frontend/src/components/StatusBadge.tsx`

**Step 1: Write the component**

```tsx
// frontend/src/components/StatusBadge.tsx
import type { AgentStatus } from '@/types/marketplace'

const STYLES: Record<AgentStatus, string> = {
  PENDING:   'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  COMPLETED: 'bg-green-500/20  text-green-400  border-green-500/30',
  DISPUTED:  'bg-red-500/20    text-red-400    border-red-500/30',
  EXPIRED:   'bg-gray-500/20   text-gray-400   border-gray-500/30',
}

export function StatusBadge({ status }: { status: AgentStatus }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STYLES[status]}`}>
      {status}
    </span>
  )
}
```

**Step 2: Commit**

```bash
cd /Users/ash/Desktop/AutoCart
git add frontend/src/components/StatusBadge.tsx
git commit -m "feat: add StatusBadge component"
```

---

### Task 5: Build `ConnectionBanner` component

**Files:**
- Create: `frontend/src/components/ConnectionBanner.tsx`

**Step 1: Write the component**

```tsx
// frontend/src/components/ConnectionBanner.tsx
'use client'

import { useEffect, useState } from 'react'

export function ConnectionBanner({ connected }: { connected: boolean }) {
  const [countdown, setCountdown] = useState(5)

  useEffect(() => {
    if (connected) {
      setCountdown(5)
      return
    }
    const t = setInterval(() => setCountdown((c) => (c > 0 ? c - 1 : 5)), 1000)
    return () => clearInterval(t)
  }, [connected])

  if (connected) return null

  return (
    <div className="flex items-center gap-2 bg-red-900/40 border border-red-700/60 text-red-300 text-sm px-4 py-2 rounded-lg mb-4">
      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
      WebSocket disconnected — reconnecting in {countdown}s…
    </div>
  )
}
```

**Step 2: Commit**

```bash
cd /Users/ash/Desktop/AutoCart
git add frontend/src/components/ConnectionBanner.tsx
git commit -m "feat: add ConnectionBanner component"
```

---

### Task 6: Build `AgentCard` component

**Files:**
- Create: `frontend/src/components/AgentCard.tsx`

**Step 1: Write the component**

```tsx
// frontend/src/components/AgentCard.tsx
import type { Agent } from '@/types/marketplace'

export function AgentCard({ agent }: { agent: Agent }) {
  const stars = Math.min(agent.reputation, 10)

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 hover:border-purple-800 transition-colors">
      <div className="flex justify-between items-start mb-2">
        <span className="font-semibold text-white">{agent.name}</span>
        <span className="text-purple-400 text-sm font-mono">{agent.priceEth} ETH</span>
      </div>

      <div className="flex flex-wrap gap-1 mb-3">
        {agent.capabilities.map((cap) => (
          <span
            key={cap}
            className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded border border-gray-700"
          >
            {cap}
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <span className="text-yellow-400 text-xs">{'★'.repeat(stars)}{'☆'.repeat(10 - stars)}</span>
          <span className="text-gray-600 text-xs ml-1">({agent.reputation})</span>
        </div>
        <span className="text-gray-700 text-xs font-mono">{agent.address.slice(0, 10)}…</span>
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
cd /Users/ash/Desktop/AutoCart
git add frontend/src/components/AgentCard.tsx
git commit -m "feat: add AgentCard component"
```

---

### Task 7: Build `AgreementRow` component

**Files:**
- Create: `frontend/src/components/AgreementRow.tsx`

**Step 1: Write the component**

```tsx
// frontend/src/components/AgreementRow.tsx
import type { Agreement } from '@/types/marketplace'
import { StatusBadge } from './StatusBadge'

export function AgreementRow({ agreement: ag }: { agreement: Agreement }) {
  const date = new Date(ag.createdAt * 1000).toLocaleTimeString()

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 hover:border-gray-700 transition-colors">
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs font-mono text-gray-600">
          {ag.hash.slice(0, 10)}…
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-purple-400 font-mono">{ag.amountEth} ETH</span>
          <StatusBadge status={ag.status} />
        </div>
      </div>

      <p className="text-sm text-gray-300 mb-2 line-clamp-1">{ag.taskDescription}</p>

      <div className="flex justify-between items-center text-xs text-gray-500">
        <span>
          <span className="font-mono">{ag.buyer.slice(0, 8)}…</span>
          {' → '}
          <span className="text-gray-400">{ag.sellerName}</span>
        </span>
        <span className="text-gray-700">{date}</span>
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
cd /Users/ash/Desktop/AutoCart
git add frontend/src/components/AgreementRow.tsx
git commit -m "feat: add AgreementRow component"
```

---

### Task 8: Wire `page.tsx` and global styles

**Files:**
- Modify: `frontend/src/app/page.tsx`
- Modify: `frontend/src/app/globals.css`
- Modify: `frontend/src/app/layout.tsx`

**Step 1: Replace `page.tsx`**

```tsx
// frontend/src/app/page.tsx
'use client'

import { useMarketplace } from '@/hooks/useMarketplace'
import { AgentCard } from '@/components/AgentCard'
import { AgreementRow } from '@/components/AgreementRow'
import { ConnectionBanner } from '@/components/ConnectionBanner'

export default function Dashboard() {
  const { agents, agreements, connected } = useMarketplace()

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6">
      <ConnectionBanner connected={connected} />

      <div className="flex items-center gap-3 mb-8">
        <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
        <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">
          AutoCart Marketplace
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Agent Registry */}
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-500 mb-4 flex items-center gap-2">
            Agent Registry
            <span className="bg-purple-900/50 text-purple-400 text-xs px-2 py-0.5 rounded-full">
              {agents.length}
            </span>
          </h2>
          <div className="space-y-3">
            {agents.map((a) => (
              <AgentCard key={a.address} agent={a} />
            ))}
            {agents.length === 0 && (
              <p className="text-gray-600 text-sm py-8 text-center border border-gray-800 border-dashed rounded-lg">
                No agents registered yet
              </p>
            )}
          </div>
        </section>

        {/* Agreement Feed */}
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-500 mb-4 flex items-center gap-2">
            Agreement Feed
            <span className="bg-purple-900/50 text-purple-400 text-xs px-2 py-0.5 rounded-full">
              {agreements.length}
            </span>
          </h2>
          <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
            {agreements.map((a) => (
              <AgreementRow key={a.hash} agreement={a} />
            ))}
            {agreements.length === 0 && (
              <p className="text-gray-600 text-sm py-8 text-center border border-gray-800 border-dashed rounded-lg">
                No agreements yet
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
```

**Step 2: Update `globals.css`** — keep Tailwind directives, set dark background default

```css
/* frontend/src/app/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  color-scheme: dark;
}

body {
  background: #030712;
}

/* Thin scrollbar for agreement feed */
::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #374151; border-radius: 2px; }
```

**Step 3: Update `layout.tsx`** — set dark metadata and remove default light styles

Open `frontend/src/app/layout.tsx`. Change the `<html>` tag to:
```tsx
<html lang="en" className="dark">
```
And change `<body>` to remove any default className that includes `antialiased` with light colors — just keep `antialiased`:
```tsx
<body className="antialiased">
```

**Step 4: Commit**

```bash
cd /Users/ash/Desktop/AutoCart
git add frontend/src/app/
git commit -m "feat: wire dashboard page with agent registry + agreement feed"
```

---

### Task 9: Build and run the dev server — verify end-to-end

**Prerequisites:** Hardhat node must be running at `ws://localhost:8545` with the contract deployed and simulation already run (sellers registered, agreements created).

**Step 1: Check Hardhat is running**

```bash
curl -s -X POST http://127.0.0.1:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"net_version","id":1}'
```

Expected: `{"jsonrpc":"2.0","id":1,"result":"31337"}`

If not running, from project root:
```bash
npx hardhat node > /tmp/hardhat.log 2>&1 &
sleep 4
npx hardhat run scripts/deploy.js --network localhost
venv/bin/python agents/simulation/run_simulation.py
```

**Step 2: Start Next.js dev server**

```bash
cd /Users/ash/Desktop/AutoCart/frontend
npm run dev
```

Expected output:
```
  ▲ Next.js 15.x.x
  - Local:        http://localhost:3000
  - ready in Xms
```

**Step 3: Open in browser**

Navigate to `http://localhost:3000`.

Verify:
- [ ] Green dot next to "AutoCart Marketplace" (WebSocket connected)
- [ ] Agent Registry shows 3 agents: SummarizeBot, WebSearchBot, CodeReviewBot
- [ ] Each agent shows capabilities as tags, price in ETH, star reputation
- [ ] Agreement Feed shows 3 agreements (newest first)
- [ ] Status badges show correct colors: DISPUTED=red, COMPLETED=green, PENDING=yellow
- [ ] WebSearchBot has rep=1 (approved), others rep=0

**Step 4: Final commit**

```bash
cd /Users/ash/Desktop/AutoCart
git add frontend/
git commit -m "feat: complete AutoCart frontend dashboard (Task 10)"
```
