import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Search, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Kbd } from '@/components/shared/Kbd'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useShortcut } from '@/hooks/use-shortcut'
import { cn } from '@/lib/utils'

export interface Facet {
  key: string
  label: string
  options: { value: string; label: string }[]
}

const ALL = '__all'

/** Filters live in the URL, so every filtered view is shareable and survives reload. */
// oxlint-disable-next-line react/only-export-components -- the hook and the bar share one contract
export function useUrlFilters<K extends string>(keys: readonly K[]) {
  const [params, setParams] = useSearchParams()
  const values = Object.fromEntries(keys.map((k) => [k, params.get(k) ?? undefined])) as Record<K, string | undefined>
  const set = (key: K, value: string | undefined) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value) next.set(key, value)
        else next.delete(key)
        return next
      },
      { replace: true },
    )
  const clear = () => setParams(new URLSearchParams(), { replace: true })
  return { values, set, clear, active: keys.some((k) => params.has(k)) }
}

interface FilterBarProps {
  search: string | undefined
  onSearch: (value: string | undefined) => void
  searchPlaceholder: string
  facets: Facet[]
  values: Record<string, string | undefined>
  onFacet: (key: string, value: string | undefined) => void
  onClear: () => void
  active: boolean
  className?: string
}

export function FilterBar({ search, onSearch, searchPlaceholder, facets, values, onFacet, onClear, active, className }: FilterBarProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState(search ?? '')
  const [syncedSearch, setSyncedSearch] = useState(search)
  useShortcut('/', () => inputRef.current?.focus())

  // Keep the box in sync when the URL changes elsewhere (e.g. "Clear") — adjusted during render.
  if (search !== syncedSearch) {
    setSyncedSearch(search)
    setDraft(search ?? '')
  }
  // Debounce typing into the URL.
  useEffect(() => {
    const t = setTimeout(() => {
      if ((search ?? '') !== draft) onSearch(draft.trim() || undefined)
    }, 200)
    return () => clearTimeout(t)
  }, [draft, search, onSearch])

  return (
    <div className={cn('mb-3 flex flex-wrap items-center gap-2', className)}>
      <div className="relative w-full sm:w-72">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          className="h-8 pr-8 pl-8 text-table"
        />
        <Kbd className="absolute top-1/2 right-2 -translate-y-1/2">/</Kbd>
      </div>
      {facets.map((f) => (
        <Select key={f.key} value={values[f.key] ?? ALL} onValueChange={(v) => onFacet(f.key, v === ALL ? undefined : v)}>
          <SelectTrigger size="sm" aria-label={f.label} className={cn('h-8 text-table', values[f.key] && 'border-foreground/30 bg-accent')}>
            <span className="text-muted-foreground">{f.label}:</span>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All</SelectItem>
            {f.options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ))}
      {active && (
        <Button variant="ghost" size="sm" onClick={onClear} className="text-muted-foreground">
          <X data-icon="inline-start" />
          Clear
        </Button>
      )}
    </div>
  )
}
