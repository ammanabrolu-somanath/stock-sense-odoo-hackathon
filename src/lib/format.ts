import type { Uom } from '@domain/types.ts'

/** India locale throughout: ₹ with lakh/crore grouping (₹12,45,300). */
const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
const inrCompact = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', notation: 'compact', maximumFractionDigits: 1 })
const num = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 3 })
const dateFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
const dateTimeFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

export const formatMoney = (n: number) => inr.format(n)
export const formatMoneyCompact = (n: number) => inrCompact.format(n)
export const formatNumber = (n: number) => num.format(n)

export const UOM_LABEL: Record<Uom, string> = { unit: 'units', kg: 'kg', m: 'm', L: 'L', box: 'boxes' }
export const formatQty = (n: number, uom: Uom) => `${num.format(n)} ${uom === 'unit' && n === 1 ? 'unit' : uom === 'box' && n === 1 ? 'box' : UOM_LABEL[uom]}`

export const formatDate = (iso: string) => dateFmt.format(new Date(iso))
export const formatDateTime = (iso: string) => dateTimeFmt.format(new Date(iso))

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('')
}
