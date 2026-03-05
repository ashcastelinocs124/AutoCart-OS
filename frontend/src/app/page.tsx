'use client'

import { useState, useCallback } from 'react'
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
  const closeModal = useCallback(() => setModalOpen(false), [])

  function openModal() {
    setModalOpen(true)
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
        onClose={closeModal}
        wallet={wallet}
      />
    </main>
  )
}
