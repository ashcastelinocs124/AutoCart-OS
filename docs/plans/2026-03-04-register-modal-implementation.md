# Register Agent Modal Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a MetaMask-connected "Register Agent" modal to the dashboard so demo participants can post their agents on-chain from the UI.

**Architecture:** Three new files (`useWallet.ts`, `WalletButton.tsx`, `RegisterModal.tsx`) plus minimal edits to `page.tsx`. The `useWallet` hook wraps `ethers.BrowserProvider` for MetaMask; `RegisterModal` calls `contract.registerService()` with the signer; the existing WS feed automatically surfaces the new agent via the `AgentRegistered` event.

**Tech Stack:** Next.js 16, ethers.js v6 (`BrowserProvider` + `JsonRpcSigner`), MetaMask (`window.ethereum`), Tailwind CSS, TypeScript

---

### Task 1: Add chain ID env var

**Files:**
- Modify: `frontend/.env.local`

**Step 1: Add one line to `frontend/.env.local`**

Open the file and append:
```
NEXT_PUBLIC_CHAIN_ID=31337
```

The full file should now be:
```
NEXT_PUBLIC_CONTRACT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
NEXT_PUBLIC_RPC_WS_URL=ws://localhost:8545
NEXT_PUBLIC_CHAIN_ID=31337
```

**Step 2: Verify TypeScript still compiles**

```bash
cd /Users/ash/Desktop/AutoCart/frontend && npx tsc --noEmit 2>&1
```

Expected: no errors.

**Step 3: Commit**

`.env.local` is gitignored — nothing to commit. Skip commit for this task.

---

### Task 2: Create `useWallet` hook

**Files:**
- Create: `frontend/src/hooks/useWallet.ts`

**Step 1: Write the hook**

```typescript
// frontend/src/hooks/useWallet.ts
'use client'

import { useState, useCallback } from 'react'
import { ethers } from 'ethers'

// Minimal type for window.ethereum (avoids adding @metamask/providers dep)
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
      on: (event: string, handler: (...args: unknown[]) => void) => void
    }
  }
}

export type WalletState = {
  account: string | null
  signer: ethers.JsonRpcSigner | null
  chainId: number | null
  connecting: boolean
  error: string | null
  connect: () => Promise<void>
  disconnect: () => void
}

export function useWallet(): WalletState {
  const [account, setAccount] = useState<string | null>(null)
  const [signer, setSigner] = useState<ethers.JsonRpcSigner | null>(null)
  const [chainId, setChainId] = useState<number | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      setError('MetaMask not found. Please install MetaMask.')
      return
    }
    setConnecting(true)
    setError(null)
    try {
      const provider = new ethers.BrowserProvider(window.ethereum)
      await provider.send('eth_requestAccounts', [])
      const s = await provider.getSigner()
      const address = await s.getAddress()
      const network = await provider.getNetwork()
      setAccount(address)
      setSigner(s)
      setChainId(Number(network.chainId))
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message.includes('rejected') ? 'Connection rejected.' : err.message)
      } else {
        setError('Failed to connect wallet.')
      }
    } finally {
      setConnecting(false)
    }
  }, [])

  const disconnect = useCallback(() => {
    setAccount(null)
    setSigner(null)
    setChainId(null)
    setError(null)
  }, [])

  return { account, signer, chainId, connecting, error, connect, disconnect }
}
```

**Step 2: TypeScript check**

```bash
cd /Users/ash/Desktop/AutoCart/frontend && npx tsc --noEmit 2>&1
```

Expected: no errors.

**Step 3: Commit**

```bash
cd /Users/ash/Desktop/AutoCart
git add frontend/src/hooks/useWallet.ts
git commit -m "feat: add useWallet hook for MetaMask connection"
```

---

### Task 3: Create `WalletButton` component

**Files:**
- Create: `frontend/src/components/WalletButton.tsx`

**Step 1: Write the component**

```tsx
// frontend/src/components/WalletButton.tsx
'use client'

import type { WalletState } from '@/hooks/useWallet'

export function WalletButton({ wallet }: { wallet: WalletState }) {
  if (wallet.account) {
    return (
      <button
        onClick={wallet.disconnect}
        className="text-xs font-mono bg-gray-800 border border-gray-700 text-gray-300 px-3 py-1.5 rounded-lg hover:border-gray-600 transition-colors"
        title="Click to disconnect"
      >
        {wallet.account.slice(0, 6)}…{wallet.account.slice(-4)}
      </button>
    )
  }

  return (
    <button
      onClick={wallet.connect}
      disabled={wallet.connecting}
      className="text-xs bg-purple-900/50 border border-purple-700 text-purple-300 px-3 py-1.5 rounded-lg hover:bg-purple-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {wallet.connecting ? 'Connecting…' : 'Connect Wallet'}
    </button>
  )
}
```

**Step 2: TypeScript check**

```bash
cd /Users/ash/Desktop/AutoCart/frontend && npx tsc --noEmit 2>&1
```

Expected: no errors.

**Step 3: Commit**

```bash
cd /Users/ash/Desktop/AutoCart
git add frontend/src/components/WalletButton.tsx
git commit -m "feat: add WalletButton component"
```

---

### Task 4: Create `RegisterModal` component

**Files:**
- Create: `frontend/src/components/RegisterModal.tsx`

**Step 1: Write the component**

```tsx
// frontend/src/components/RegisterModal.tsx
'use client'

import { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import ABI from '@/lib/abi'
import type { WalletState } from '@/hooks/useWallet'

type Props = {
  isOpen: boolean
  onClose: () => void
  wallet: WalletState
}

type TxStatus = 'idle' | 'pending' | 'success' | 'error'

const EXPECTED_CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? '31337')
const CHAIN_NAMES: Record<number, string> = {
  31337: 'Hardhat Local',
  11155111: 'Sepolia',
  84532: 'Base Sepolia',
  1: 'Ethereum Mainnet',
}

export function RegisterModal({ isOpen, onClose, wallet }: Props) {
  const [name, setName] = useState('')
  const [capabilities, setCapabilities] = useState('')
  const [endpoint, setEndpoint] = useState('')
  const [price, setPrice] = useState('')
  const [status, setStatus] = useState<TxStatus>('idle')
  const [txError, setTxError] = useState<string | null>(null)

  // Auto-close 2 seconds after success
  useEffect(() => {
    if (status !== 'success') return
    const t = setTimeout(() => { onClose(); resetForm() }, 2000)
    return () => clearTimeout(t)
  }, [status, onClose])

  function resetForm() {
    setName(''); setCapabilities(''); setEndpoint(''); setPrice('')
    setStatus('idle'); setTxError(null)
  }

  function handleClose() { onClose(); resetForm() }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!wallet.signer) return
    setStatus('pending')
    setTxError(null)
    try {
      const contract = new ethers.Contract(
        process.env.NEXT_PUBLIC_CONTRACT_ADDRESS!,
        ABI,
        wallet.signer
      )
      const tx = await contract.registerService(
        name.trim(),
        capabilities.trim(),
        endpoint.trim(),
        ethers.parseEther(price)
      )
      await tx.wait()
      setStatus('success')
    } catch (err: unknown) {
      setStatus('error')
      if (err instanceof Error) {
        const msg = err.message
        setTxError(
          msg.includes('rejected') || msg.includes('denied')
            ? 'Transaction cancelled.'
            : msg.slice(0, 140)
        )
      } else {
        setTxError('Transaction failed.')
      }
    }
  }

  if (!isOpen) return null

  const wrongNetwork =
    wallet.chainId !== null && wallet.chainId !== EXPECTED_CHAIN_ID
  const expectedName = CHAIN_NAMES[EXPECTED_CHAIN_ID] ?? `Chain ${EXPECTED_CHAIN_ID}`

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={handleClose} />

      {/* Slide-over panel */}
      <div className="relative z-10 h-full w-full max-w-md bg-gray-950 border-l border-gray-800 flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white">Register Your Agent</h2>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-300 text-xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* Not connected */}
          {!wallet.account ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-400">
                Connect your wallet to register an agent on-chain.
              </p>
              {wallet.error && (
                <p className="text-xs text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
                  {wallet.error}
                </p>
              )}
              <button
                onClick={wallet.connect}
                disabled={wallet.connecting}
                className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
              >
                {wallet.connecting ? 'Connecting…' : 'Connect MetaMask'}
              </button>
            </div>
          ) : (
            <div className="space-y-4">

              {/* Connected badge */}
              <div className="flex items-center gap-2 text-xs bg-gray-900 border border-gray-800 rounded-lg px-3 py-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                <span className="font-mono text-gray-300">
                  {wallet.account.slice(0, 10)}…{wallet.account.slice(-6)}
                </span>
              </div>

              {/* Wrong network warning */}
              {wrongNetwork && (
                <div className="text-xs bg-yellow-900/20 border border-yellow-700/60 text-yellow-300 rounded-lg px-3 py-2">
                  ⚠ Wrong network — switch to <strong>{expectedName}</strong> or your transaction may fail.
                </div>
              )}

              {/* Success */}
              {status === 'success' ? (
                <div className="text-sm bg-green-900/20 border border-green-700 text-green-300 rounded-lg px-4 py-4 text-center">
                  ✅ Agent registered! Closing in 2s…
                </div>
              ) : (
                /* Registration form */
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">
                      Agent Name
                    </label>
                    <input
                      required
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="SummarizeBot"
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-600 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">
                      Capabilities{' '}
                      <span className="text-gray-600 font-normal">(comma-separated)</span>
                    </label>
                    <input
                      required
                      value={capabilities}
                      onChange={e => setCapabilities(e.target.value)}
                      placeholder="summarization,nlp,text-analysis"
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-600 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">
                      Endpoint URL
                    </label>
                    <input
                      required
                      type="url"
                      value={endpoint}
                      onChange={e => setEndpoint(e.target.value)}
                      placeholder="https://my-agent.vercel.app"
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-600 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">
                      Price per task (ETH)
                    </label>
                    <input
                      required
                      type="number"
                      step="0.001"
                      min="0"
                      value={price}
                      onChange={e => setPrice(e.target.value)}
                      placeholder="0.005"
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-600 transition-colors"
                    />
                  </div>

                  {/* Tx error */}
                  {txError && (
                    <p className="text-xs text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
                      {txError}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={status === 'pending'}
                    className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
                  >
                    {status === 'pending' ? '⏳ Waiting for confirmation…' : '+ Register Agent'}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

**Step 2: TypeScript check**

```bash
cd /Users/ash/Desktop/AutoCart/frontend && npx tsc --noEmit 2>&1
```

Expected: no errors.

**Step 3: Commit**

```bash
cd /Users/ash/Desktop/AutoCart
git add frontend/src/components/RegisterModal.tsx
git commit -m "feat: add RegisterModal component with MetaMask tx flow"
```

---

### Task 5: Wire `page.tsx`

**Files:**
- Modify: `frontend/src/app/page.tsx`

**Step 1: Replace the full file**

```tsx
// frontend/src/app/page.tsx
'use client'

import { useState } from 'react'
import { useMarketplace } from '@/hooks/useMarketplace'
import { useWallet } from '@/hooks/useWallet'
import { AgentCard } from '@/components/AgentCard'
import { AgreementRow } from '@/components/AgreementRow'
import { ConnectionBanner } from '@/components/ConnectionBanner'
import { WalletButton } from '@/components/WalletButton'
import { RegisterModal } from '@/components/RegisterModal'

export default function Dashboard() {
  const { agents, agreements, connected } = useMarketplace()
  const wallet = useWallet()
  const [modalOpen, setModalOpen] = useState(false)

  function openModal() {
    if (!wallet.account) {
      wallet.connect().then(() => setModalOpen(true))
    } else {
      setModalOpen(true)
    }
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6">
      <ConnectionBanner connected={connected} />

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
          <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">
            AutoCart Marketplace
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <WalletButton wallet={wallet} />
          <button
            onClick={openModal}
            className="text-xs bg-purple-600 hover:bg-purple-500 text-white font-medium px-3 py-1.5 rounded-lg transition-colors"
          >
            + Register Agent
          </button>
        </div>
      </div>

      {/* Two-panel layout */}
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

      {/* Modal */}
      <RegisterModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        wallet={wallet}
      />
    </main>
  )
}
```

**Step 2: TypeScript check**

```bash
cd /Users/ash/Desktop/AutoCart/frontend && npx tsc --noEmit 2>&1
```

Expected: no errors. If there are errors, read them carefully and fix before committing.

**Step 3: Commit**

```bash
cd /Users/ash/Desktop/AutoCart
git add frontend/src/app/page.tsx
git commit -m "feat: wire RegisterModal + WalletButton into dashboard"
```

---

### Task 6: Build verification

**Step 1: Run production build**

```bash
cd /Users/ash/Desktop/AutoCart/frontend && npm run build 2>&1 | tail -15
```

Expected: compiled successfully, no TypeScript errors, no build errors.

**Step 2: Confirm dev server serves the page**

The dev server should already be running at `http://localhost:3000`. If not:
```bash
cd /Users/ash/Desktop/AutoCart/frontend && npm run dev > /tmp/nextjs.log 2>&1 &
sleep 5
curl -s http://localhost:3000 -o /dev/null -w "%{http_code}"
```
Expected: `200`.

**Step 3: Visual verification checklist** (manual — open browser)

- [ ] Header shows "AutoCart Marketplace" + "Connect Wallet" button + "+ Register Agent" button
- [ ] Clicking "+ Register Agent" opens the slide-over panel
- [ ] Panel shows "Connect MetaMask" when wallet not connected
- [ ] After connecting, panel shows form with 4 fields
- [ ] Form has correct placeholders and labels
- [ ] Submit button says "+ Register Agent"
- [ ] Agent Registry and Agreement Feed still show correctly

**Step 4: Final commit**

```bash
cd /Users/ash/Desktop/AutoCart
git add -A
git commit -m "feat: complete register-agent modal with MetaMask integration"
```
