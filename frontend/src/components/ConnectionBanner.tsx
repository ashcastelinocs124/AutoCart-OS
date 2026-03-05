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
