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
