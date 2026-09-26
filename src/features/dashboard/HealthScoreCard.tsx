import type { HealthScore } from '@domain/health-score.ts'
import { AnimatedNumber } from '@/components/shared/AnimatedNumber'
import { cn } from '@/lib/utils'
import { Panel } from './Panel'

const GRADE_TONE = { Excellent: 'text-success', Good: 'text-success', Fair: 'text-warning', Critical: 'text-danger' } as const
const STROKE = { Excellent: 'stroke-success', Good: 'stroke-success', Fair: 'stroke-warning', Critical: 'stroke-danger' } as const

/**
 * Explainable by construction: the ring shows the score, and every point lost is attributed
 * to one of four factors with the sentence that explains it. Grade is text, never colour alone.
 */
export function HealthScoreCard({ health }: { health: HealthScore }) {
  const r = 34
  const c = 2 * Math.PI * r
  return (
    <Panel title="Inventory health">
      <div className="flex items-center gap-4 p-4">
        <div className="relative size-[88px] shrink-0">
          <svg viewBox="0 0 80 80" className="size-full -rotate-90" aria-hidden="true">
            <circle cx="40" cy="40" r={r} className="fill-none stroke-muted" strokeWidth="7" />
            <circle
              cx="40"
              cy="40"
              r={r}
              className={cn('fill-none transition-[stroke-dashoffset] duration-700', STROKE[health.grade])}
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={c * (1 - health.score / 100)}
            />
          </svg>
          <div className="absolute inset-0 grid place-items-center">
            <span className="text-2xl font-semibold tabular-nums tracking-tight">
              <AnimatedNumber value={health.score} />
            </span>
          </div>
        </div>
        <div>
          <p className={cn('text-lg font-semibold', GRADE_TONE[health.grade])} data-testid="health-grade">
            {health.grade}
          </p>
          <p className="text-xs text-muted-foreground">Score out of 100, from four weighted factors.</p>
        </div>
      </div>
      <ul className="grid gap-3 border-t p-4" aria-label="Health score factors">
        {health.factors.map((f) => (
          <li key={f.key}>
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="font-medium">{f.label}</span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {f.points} / {f.weight}
              </span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-muted" aria-hidden="true">
              <div className="h-full rounded-full bg-foreground/70" style={{ width: `${f.value * 100}%` }} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{f.detail}</p>
          </li>
        ))}
      </ul>
    </Panel>
  )
}
