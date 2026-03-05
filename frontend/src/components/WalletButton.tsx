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
