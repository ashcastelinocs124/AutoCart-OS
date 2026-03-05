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
