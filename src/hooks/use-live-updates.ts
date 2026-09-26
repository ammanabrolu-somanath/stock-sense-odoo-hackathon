import { useEffect, useRef, useState } from 'react'

import { useInvalidateStock } from '@/features/products/queries'

export type LiveStatus = 'connecting' | 'live' | 'offline'

/**
 * Subscribes to the API's Server-Sent Events. Any write anywhere (another tab, another
 * user) refreshes every ledger-derived number on screen — the spec's "real-time".
 * Bursts are coalesced so a pick → pack → validate sequence refetches once.
 */
export function useLiveUpdates(): LiveStatus {
  const invalidate = useInvalidateStock()
  const invalidateRef = useRef(invalidate)
  useEffect(() => {
    invalidateRef.current = invalidate
  })
  const [status, setStatus] = useState<LiveStatus>('connecting')

  useEffect(() => {
    if (typeof EventSource === 'undefined') return
    const source = new EventSource('/api/events')
    let timer: ReturnType<typeof setTimeout> | undefined
    source.onopen = () => setStatus('live')
    source.onerror = () => setStatus(source.readyState === EventSource.CLOSED ? 'offline' : 'connecting')
    source.addEventListener('change', () => {
      clearTimeout(timer)
      timer = setTimeout(() => void invalidateRef.current(), 250)
    })
    return () => {
      clearTimeout(timer)
      source.close()
    }
  }, [])

  return status
}
