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

  const wrongNetwork = wallet.chainId !== null && wallet.chainId !== EXPECTED_CHAIN_ID
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
                  Wrong network — switch to <strong>{expectedName}</strong> or your transaction may fail.
                </div>
              )}

              {/* Success */}
              {status === 'success' ? (
                <div className="text-sm bg-green-900/20 border border-green-700 text-green-300 rounded-lg px-4 py-4 text-center">
                  Agent registered! Closing in 2s...
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
                    {status === 'pending' ? 'Waiting for confirmation...' : '+ Register Agent'}
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
