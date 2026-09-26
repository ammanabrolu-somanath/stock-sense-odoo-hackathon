import type { LocationSummary } from '@domain/api.ts'
import type { Id } from '@domain/types.ts'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'

/** Internal locations grouped by warehouse ("HYD/Rack A"). Virtual locations are never offered. */
export function LocationSelect({
  id,
  locations,
  value,
  onChange,
  invalid,
  exclude,
}: {
  id: string
  locations: LocationSummary[]
  value: Id | undefined
  onChange: (id: Id) => void
  invalid?: boolean
  exclude?: Id
}) {
  const groups = new Map<string, LocationSummary[]>()
  for (const l of locations) {
    if (l.kind !== 'internal' || l.id === exclude) continue
    const code = l.fullName.split('/')[0]
    groups.set(code, [...(groups.get(code) ?? []), l])
  }
  return (
    <Select value={value ? String(value) : ''} onValueChange={(v) => onChange(Number(v))}>
      <SelectTrigger id={id} className="w-full" aria-invalid={invalid || undefined}>
        <SelectValue placeholder="Choose a location" />
      </SelectTrigger>
      <SelectContent>
        {[...groups].map(([code, locs]) => (
          <SelectGroup key={code}>
            <SelectLabel>{code}</SelectLabel>
            {locs.map((l) => (
              <SelectItem key={l.id} value={String(l.id)}>
                {l.fullName}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  )
}
