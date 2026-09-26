import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { Moon, Package, Plus, Search, Sun } from 'lucide-react'

import { Kbd } from '@/components/shared/Kbd'
import { Button } from '@/components/ui/button'
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command'
import { OPERATION_CONFIG, operationUrl } from '@/features/operations/config'
import { useProducts } from '@/features/products/queries'
import { navGroups } from './nav'
import { useTheme } from './theme'

/** ⌘K / Ctrl+K: jump anywhere, create any document, find a product by name or SKU. */
export function CommandMenu() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const products = useProducts()
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const go = (to: string) => {
    setOpen(false)
    navigate(to)
  }
  const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform)

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="h-8 w-8 justify-center px-0 text-muted-foreground sm:w-56 sm:justify-start sm:px-2.5"
        aria-label="Search and commands"
      >
        <Search />
        <span className="hidden flex-1 text-left font-normal sm:inline">Search or jump to…</span>
        <Kbd className="hidden sm:inline-flex">{isMac ? '⌘K' : 'Ctrl K'}</Kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen} title="Command menu" description="Search pages, create documents, or find a product">
        <Command>
        <CommandInput placeholder="Type a page, an action, or a product name / SKU…" />
        <CommandList>
          <CommandEmpty>No results.</CommandEmpty>
          <CommandGroup heading="Create">
            {Object.values(OPERATION_CONFIG).map((c) => (
              <CommandItem key={c.type} value={`new ${c.label}`} onSelect={() => go(operationUrl(c.type, 'new'))}>
                <Plus />
                New {c.label.toLowerCase()}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Go to">
            {navGroups.flatMap((g) => g.items).map((item) => (
              <CommandItem key={item.to} value={`go ${item.title}`} onSelect={() => go(item.to)}>
                <item.icon />
                {item.title}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Products">
            {(products.data ?? []).map((p) => (
              <CommandItem key={p.id} value={`${p.name} ${p.sku}`} onSelect={() => go(`/products/${p.id}`)}>
                <Package />
                <span className="truncate">{p.name}</span>
                <span className="ml-auto font-mono text-xs text-muted-foreground">{p.sku}</span>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Preferences">
            <CommandItem
              value="toggle theme dark light"
              onSelect={() => {
                setTheme(theme === 'dark' ? 'light' : 'dark')
                setOpen(false)
              }}
            >
              {theme === 'dark' ? <Sun /> : <Moon />}
              Switch to {theme === 'dark' ? 'light' : 'dark'} theme
            </CommandItem>
          </CommandGroup>
        </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}
