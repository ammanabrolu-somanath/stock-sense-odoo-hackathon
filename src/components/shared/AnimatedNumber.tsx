import { useEffect, useRef } from 'react'
import { animate, useReducedMotion } from 'motion/react'

import { formatNumber } from '@/lib/format'

/**
 * Counts to a new value when it changes (e.g. after a live update), so the change is noticed.
 * Honors prefers-reduced-motion; the final text is always the exact formatted value.
 */
export function AnimatedNumber({ value, format = formatNumber }: { value: number; format?: (n: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const previous = useRef(value)
  const reduce = useReducedMotion()

  useEffect(() => {
    const node = ref.current
    const from = previous.current
    previous.current = value
    if (!node || reduce || from === value) {
      if (node) node.textContent = format(value)
      return
    }
    const controls = animate(from, value, {
      duration: 0.6,
      ease: [0.2, 0.8, 0.2, 1],
      onUpdate: (v) => {
        node.textContent = format(Number.isInteger(value) ? Math.round(v) : v)
      },
      onComplete: () => {
        node.textContent = format(value)
      },
    })
    return () => controls.stop()
  }, [value, reduce, format])

  return <span ref={ref}>{format(value)}</span>
}
