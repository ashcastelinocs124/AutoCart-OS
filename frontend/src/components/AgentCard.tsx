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
