import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  ClipboardCheck,
  History,
  LayoutDashboard,
  Package,
  Settings2,
  Warehouse,
  type LucideIcon,
} from 'lucide-react'

export type NavItem = {
  title: string
  to: string
  icon: LucideIcon
  /** Key used to look up a pending-count badge (wired in H5). */
  badgeKey?: 'receipt' | 'delivery' | 'transfer' | 'adjustment'
}

export type NavGroup = { label: string; items: NavItem[] }

/** Navigation mirrors the official problem statement's IA (Products · Operations · Move History · Settings). */
export const navGroups: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { title: 'Dashboard', to: '/', icon: LayoutDashboard },
      { title: 'Products', to: '/products', icon: Package },
    ],
  },
  {
    label: 'Operations',
    items: [
      { title: 'Receipts', to: '/operations/receipts', icon: ArrowDownToLine, badgeKey: 'receipt' },
      { title: 'Deliveries', to: '/operations/deliveries', icon: ArrowUpFromLine, badgeKey: 'delivery' },
      { title: 'Transfers', to: '/operations/transfers', icon: ArrowLeftRight, badgeKey: 'transfer' },
      { title: 'Adjustments', to: '/operations/adjustments', icon: ClipboardCheck, badgeKey: 'adjustment' },
    ],
  },
  {
    label: 'Reporting',
    items: [{ title: 'Move History', to: '/moves', icon: History }],
  },
  {
    label: 'Settings',
    items: [
      { title: 'Warehouses', to: '/settings/warehouses', icon: Warehouse },
      { title: 'General', to: '/settings/general', icon: Settings2 },
    ],
  },
]
