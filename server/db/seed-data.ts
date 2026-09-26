import type { Uom } from '@domain/types.ts'

/**
 * Demo catalogue — an Indian distribution business with three warehouses.
 * `profile` engineers the end state the demo story needs:
 *   normal — replenished by the min/max rule throughout
 *   low    — replenishment stops near the end, finishing below its reorder minimum
 *   out    — finishes out of stock (with a customer order waiting on it)
 *   dead   — stocked, never sells (feeds the dead-stock factor of the health score)
 */
export type Profile = 'normal' | 'low' | 'out' | 'dead'

export interface SeedProduct {
  sku: string
  name: string
  category: string
  uom: Uom
  cost: number
  price: number
  min: number
  max: number
  lead: number
  supplier: string
  /** Average units per day per home warehouse. */
  demand: number
  homes: WarehouseCode[]
  profile: Profile
}

export type WarehouseCode = 'HYD' | 'BLR' | 'BOM'

export const WAREHOUSES: { code: WarehouseCode; name: string; city: string; capacityUnits: number }[] = [
  { code: 'HYD', name: 'Hyderabad Main', city: 'Hyderabad', capacityUnits: 14000 },
  { code: 'BLR', name: 'Bengaluru DC', city: 'Bengaluru', capacityUnits: 9000 },
  { code: 'BOM', name: 'Mumbai Hub', city: 'Mumbai', capacityUnits: 8000 },
]

/** Internal locations created in every warehouse (per the spec's transfer examples). */
export const INTERNAL_LOCATIONS = ['Stock', 'Rack A', 'Rack B', 'Production Floor'] as const

export const CATEGORIES = ['Raw Materials', 'Electronics', 'Packaging', 'Office Supplies', 'Furniture', 'Safety Equipment']

export const CUSTOMERS = [
  'Reliance Retail',
  'BigBasket Fulfilment',
  'Tata Projects',
  'L&T Construction',
  'Flipkart Warehouse',
  'DMart Supply Chain',
  'Apollo Hospitals',
  'Infosys Facilities',
  'Mahindra Logistics',
  'Asian Paints Depot',
  'Zepto Dark Store',
  'Godrej Properties',
]

type Row = [sku: string, name: string, category: string, uom: Uom, cost: number, price: number, min: number, max: number, lead: number, supplier: string, demand: number, homes: WarehouseCode[], profile: Profile]

const ROWS: Row[] = [
  ['RM-STL-012', 'Steel Rods 12mm', 'Raw Materials', 'kg', 68, 85, 400, 1500, 5, 'Tata Steel Distributors', 30, ['HYD', 'BLR'], 'normal'],
  ['RM-ALU-SH2', 'Aluminium Sheet 2mm', 'Raw Materials', 'kg', 240, 310, 150, 600, 7, 'Hindalco Metals', 10, ['HYD'], 'normal'],
  ['RM-CU-W15', 'Copper Wire 1.5mm', 'Raw Materials', 'm', 18, 26, 800, 3000, 6, 'Polycab Wires', 60, ['HYD', 'BOM'], 'normal'],
  ['RM-PVC-P1', 'PVC Pipe 1 inch', 'Raw Materials', 'm', 42, 60, 200, 800, 4, 'Supreme Industries', 12, ['BLR'], 'normal'],
  ['RM-EPX-RES', 'Epoxy Resin', 'Raw Materials', 'L', 520, 690, 40, 160, 10, 'Pidilite Industrial', 3, ['BOM'], 'low'],
  ['RM-SS-M8', 'Stainless Bolts M8', 'Raw Materials', 'box', 380, 520, 30, 120, 5, 'Jindal Supply Co.', 3, ['HYD', 'BLR'], 'normal'],
  ['RM-PLY-18', 'Plywood Sheet 18mm', 'Raw Materials', 'unit', 1650, 2100, 20, 80, 8, 'Century Plyboards', 2, ['BLR'], 'normal'],

  ['EL-SCN-2D', 'Barcode Scanner 2D', 'Electronics', 'unit', 3200, 4499, 10, 40, 12, 'Element14 India', 0.8, ['HYD', 'BOM'], 'normal'],
  ['EL-LBL-PRN', 'Thermal Label Printer', 'Electronics', 'unit', 8900, 11999, 4, 15, 14, 'Element14 India', 0.3, ['HYD'], 'normal'],
  ['EL-RFID-RL', 'RFID Tag Roll', 'Electronics', 'box', 1400, 1950, 15, 60, 10, 'Robu Components', 1.5, ['BLR', 'BOM'], 'low'],
  ['EL-USB-HUB', 'USB-C Hub 7-port', 'Electronics', 'unit', 1100, 1599, 15, 60, 7, 'Robu Components', 1.5, ['BLR'], 'normal'],
  ['EL-LED-36W', 'LED Panel 36W', 'Electronics', 'unit', 780, 1099, 30, 120, 6, 'Syska Distributors', 4, ['HYD', 'BLR'], 'normal'],
  ['EL-UPS-1K', 'UPS 1kVA', 'Electronics', 'unit', 5200, 6899, 5, 20, 10, 'Syska Distributors', 0.4, ['BOM'], 'out'],
  ['EL-TAB-10', 'Rugged Tablet 10 inch', 'Electronics', 'unit', 21000, 26999, 3, 10, 21, 'Element14 India', 0, ['HYD'], 'dead'],

  ['PK-BOX-M', 'Corrugated Box Medium', 'Packaging', 'unit', 28, 42, 500, 2000, 4, 'Pack Kraft India', 70, ['HYD', 'BLR', 'BOM'], 'normal'],
  ['PK-BOX-L', 'Corrugated Box Large', 'Packaging', 'unit', 44, 65, 300, 1200, 4, 'Pack Kraft India', 35, ['HYD', 'BOM'], 'normal'],
  ['PK-TAPE-48', 'BOPP Tape 48mm', 'Packaging', 'box', 540, 720, 25, 100, 3, 'Uflex Packaging', 4, ['HYD', 'BLR', 'BOM'], 'normal'],
  ['PK-STR-WRP', 'Stretch Wrap Roll', 'Packaging', 'unit', 310, 430, 40, 160, 5, 'Uflex Packaging', 5, ['BLR'], 'normal'],
  ['PK-BUB-50', 'Bubble Wrap Roll 50m', 'Packaging', 'unit', 620, 850, 20, 80, 5, 'Uflex Packaging', 2.5, ['BOM'], 'low'],
  ['PK-PALLET', 'Wooden Pallet', 'Packaging', 'unit', 750, 980, 40, 150, 7, 'Pack Kraft India', 4, ['HYD'], 'normal'],

  ['OF-A4-RM', 'A4 Paper Ream', 'Office Supplies', 'box', 1450, 1850, 20, 80, 3, 'Navneet Office', 2, ['HYD', 'BLR'], 'normal'],
  ['OF-TONER', 'Laser Toner Cartridge', 'Office Supplies', 'unit', 2400, 3299, 8, 30, 7, 'Navneet Office', 0.6, ['BLR'], 'normal'],
  ['OF-BOXFILE', 'Box File', 'Office Supplies', 'unit', 95, 140, 60, 250, 4, 'Kokuyo Camlin', 5, ['BOM'], 'normal'],
  ['OF-MARKER', 'Permanent Marker Pack', 'Office Supplies', 'box', 180, 260, 25, 100, 3, 'Kokuyo Camlin', 2, ['HYD'], 'normal'],

  ['FN-CHR-ERG', 'Ergonomic Chair', 'Furniture', 'unit', 7800, 10499, 6, 24, 14, 'Godrej Interio', 0.4, ['BLR', 'BOM'], 'normal'],
  ['FN-RACK-5T', 'Heavy Duty Rack 5-tier', 'Furniture', 'unit', 9600, 12999, 4, 15, 18, 'Godrej Interio', 0.3, ['HYD'], 'normal'],
  ['FN-DESK-ST', 'Standing Desk', 'Furniture', 'unit', 18500, 23999, 3, 10, 21, 'Featherlite', 0, ['BLR'], 'dead'],
  ['FN-CAB-4D', 'Filing Cabinet 4-drawer', 'Furniture', 'unit', 8200, 10999, 3, 12, 14, 'Godrej Interio', 0.15, ['BOM'], 'normal'],

  ['SF-HELMET', 'Safety Helmet', 'Safety Equipment', 'unit', 240, 340, 50, 200, 5, 'Karam Safety', 5, ['HYD', 'BLR'], 'normal'],
  ['SF-GLOVE-C', 'Cut-resistant Gloves', 'Safety Equipment', 'box', 890, 1190, 20, 80, 5, 'Udyogi Safety', 2.5, ['HYD', 'BLR', 'BOM'], 'normal'],
  ['SF-VEST-HV', 'Hi-Vis Vest', 'Safety Equipment', 'unit', 150, 220, 60, 240, 5, 'Udyogi Safety', 5, ['BLR', 'BOM'], 'normal'],
  ['SF-SHOE', 'Safety Shoes', 'Safety Equipment', 'unit', 1350, 1790, 20, 80, 10, 'Karam Safety', 1.5, ['HYD'], 'low'],
  ['SF-FIRE-4K', 'Fire Extinguisher 4kg', 'Safety Equipment', 'unit', 2100, 2790, 6, 24, 12, 'Ceasefire Industries', 0.2, ['HYD', 'BOM'], 'normal'],
  ['SF-FAK', 'First Aid Kit', 'Safety Equipment', 'unit', 650, 890, 10, 40, 6, 'Udyogi Safety', 0.8, ['BOM'], 'normal'],
]

export const PRODUCTS: SeedProduct[] = ROWS.map(
  ([sku, name, category, uom, cost, price, min, max, lead, supplier, demand, homes, profile]) => ({
    sku, name, category, uom, cost, price, min, max, lead, supplier, demand, homes, profile,
  }),
)
