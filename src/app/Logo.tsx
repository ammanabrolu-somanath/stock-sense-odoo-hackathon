import { Link } from 'react-router'

/** Wordmark: a plain stacked-bins glyph, no gradient. */
export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <svg viewBox="0 0 20 20" className="size-5 shrink-0" aria-hidden="true">
        <rect x="1" y="1" width="18" height="18" rx="4" className="fill-foreground" />
        <rect x="5" y="5" width="10" height="2.5" rx="1" className="fill-background" />
        <rect x="5" y="8.75" width="10" height="2.5" rx="1" className="fill-background opacity-70" />
        <rect x="5" y="12.5" width="6" height="2.5" rx="1" className="fill-primary" />
      </svg>
      <span className="text-[15px] font-semibold tracking-tight group-data-[collapsible=icon]:hidden">StockSense</span>
    </Link>
  )
}
