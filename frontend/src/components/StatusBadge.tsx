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
