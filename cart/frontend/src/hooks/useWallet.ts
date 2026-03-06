'use client'

import { useState, useCallback } from 'react'
import { ethers } from 'ethers'

const EXPECTED_CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? '31337')
const EXPECTED_CHAIN_HEX = `0x${EXPECTED_CHAIN_ID.toString(16)}`
const FALLBACK_RPC_URL = process.env.NEXT_PUBLIC_RPC_HTTP_URL ?? 'http://127.0.0.1:8545'
const FALLBACK_CHAIN_NAME = EXPECTED_CHAIN_ID === 31337 ? 'Hardhat Local' : `Chain ${EXPECTED_CHAIN_ID}`

type RequestArguments = {
  method: string
  params?: unknown[] | Record<string, unknown>
}

type InjectedProvider = {
  isMetaMask?: boolean
  providers?: InjectedProvider[]
  request: (args: RequestArguments) => Promise<unknown>
  on?: (event: string, handler: (...args: unknown[]) => void) => void
}

declare global {
  interface Window {
    ethereum?: InjectedProvider
  }
}

function getMetaMaskProvider(): InjectedProvider | null {
  const injected = window.ethereum
  if (!injected) return null

  if (Array.isArray(injected.providers) && injected.providers.length > 0) {
    return injected.providers.find((provider) => provider.isMetaMask) ?? null
  }

  return injected.isMetaMask ? injected : injected
}

async function ensureExpectedChain(provider: InjectedProvider) {
  const currentChain = await provider.request({ method: 'eth_chainId' })
  if (currentChain === EXPECTED_CHAIN_HEX) return

  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: EXPECTED_CHAIN_HEX }],
    })
  } catch (switchError) {
    const err = switchError as { code?: number }
    if (err.code !== 4902) throw switchError

    await provider.request({
      method: 'wallet_addEthereumChain',
      params: [{
        chainId: EXPECTED_CHAIN_HEX,
        chainName: FALLBACK_CHAIN_NAME,
        nativeCurrency: {
          name: 'Ether',
          symbol: 'ETH',
          decimals: 18,
        },
        rpcUrls: [FALLBACK_RPC_URL],
      }],
    })
  }
}

function formatWalletError(err: unknown): string {
  const error = err as {
    code?: number
    message?: string
    error?: { code?: number; message?: string }
    info?: { error?: { code?: number; message?: string } }
  }

  const code = error.code ?? error.error?.code ?? error.info?.error?.code
  const message = error.message ?? error.error?.message ?? error.info?.error?.message

  if (code === 4001 || message?.toLowerCase().includes('rejected')) {
    return 'Connection rejected.'
  }

  if (code === -32603 && message?.includes('eth_chainId')) {
    return 'Wallet provider failed to respond to eth_chainId. Open MetaMask, unlock it, and make sure the selected network is available.'
  }

  if (message?.includes('Could not establish connection')) {
    return 'Wallet connection failed. Reload the page and try again.'
  }

  return message ?? 'Failed to connect wallet.'
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
    const injectedProvider = getMetaMaskProvider()

    if (!injectedProvider) {
      setError('MetaMask not found. Please install MetaMask.')
      return
    }

    setConnecting(true)
    setError(null)

    try {
      await injectedProvider.request({ method: 'eth_requestAccounts' })
      await ensureExpectedChain(injectedProvider)

      const provider = new ethers.BrowserProvider(injectedProvider)
      await provider.send('eth_requestAccounts', [])
      const s = await provider.getSigner()
      const address = await s.getAddress()
      const network = await provider.getNetwork()
      setAccount(address)
      setSigner(s)
      setChainId(Number(network.chainId))
    } catch (err: unknown) {
      setError(formatWalletError(err))
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
