/**
 * StockSense schema (SQLite).
 *
 * Design rules:
 *  - On-hand stock is NOT a column anywhere. It is the `stock_quants` view over `stock_moves`.
 *  - `stock_moves` is append-only, enforced by triggers — history cannot be rewritten.
 *  - Every move is double-entry (from_location → to_location); virtual locations (vendors,
 *    customers, inventory adjustment) make receipts, deliveries and counts one uniform shape.
 */
export const SCHEMA_VERSION = 2

export const schemaSql = /* sql */ `
CREATE TABLE users (
  id            INTEGER PRIMARY KEY,
  name          TEXT NOT NULL CHECK (length(trim(name)) > 0),
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);
CREATE INDEX idx_sessions_user ON sessions(user_id);

CREATE TABLE password_otps (
  id         INTEGER PRIMARY KEY,
  email      TEXT NOT NULL COLLATE NOCASE,
  code_hash  TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at    TEXT,
  attempts   INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_otps_email ON password_otps(email);

CREATE TABLE categories (
  id   INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE CHECK (length(trim(name)) > 0)
);

CREATE TABLE products (
  id             INTEGER PRIMARY KEY,
  sku            TEXT NOT NULL UNIQUE COLLATE NOCASE CHECK (length(trim(sku)) > 0),
  name           TEXT NOT NULL CHECK (length(trim(name)) > 0),
  category_id    INTEGER NOT NULL REFERENCES categories(id),
  uom            TEXT NOT NULL CHECK (uom IN ('unit','kg','m','L','box')),
  cost           REAL NOT NULL DEFAULT 0 CHECK (cost >= 0),
  price          REAL NOT NULL DEFAULT 0 CHECK (price >= 0),
  reorder_min    REAL NOT NULL DEFAULT 0 CHECK (reorder_min >= 0),
  reorder_max    REAL NOT NULL DEFAULT 0 CHECK (reorder_max >= reorder_min),
  lead_time_days INTEGER NOT NULL DEFAULT 7 CHECK (lead_time_days >= 0),
  supplier       TEXT,
  archived       INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0,1)),
  created_at     TEXT NOT NULL
);
CREATE INDEX idx_products_category ON products(category_id);

CREATE TABLE warehouses (
  id             INTEGER PRIMARY KEY,
  code           TEXT NOT NULL UNIQUE COLLATE NOCASE CHECK (length(code) BETWEEN 2 AND 5),
  name           TEXT NOT NULL,
  city           TEXT NOT NULL,
  capacity_units REAL NOT NULL CHECK (capacity_units > 0)
);

CREATE TABLE locations (
  id           INTEGER PRIMARY KEY,
  warehouse_id INTEGER REFERENCES warehouses(id),
  name         TEXT NOT NULL,
  kind         TEXT NOT NULL CHECK (kind IN ('internal','vendor','customer','adjustment')),
  -- internal locations belong to a warehouse; virtual ones never do
  CHECK ((kind = 'internal') = (warehouse_id IS NOT NULL)),
  UNIQUE (warehouse_id, name)
);
-- Exactly one vendor / customer / adjustment location: every virtual move posts to the same row.
CREATE UNIQUE INDEX idx_locations_one_virtual_per_kind ON locations(kind) WHERE kind <> 'internal';

CREATE TABLE sequences (
  key        TEXT PRIMARY KEY,
  next_value INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE operations (
  id                 INTEGER PRIMARY KEY,
  reference          TEXT NOT NULL UNIQUE,
  type               TEXT NOT NULL CHECK (type IN ('receipt','delivery','transfer','adjustment')),
  status             TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','waiting','ready','done','canceled')),
  partner            TEXT,
  source_location_id INTEGER NOT NULL REFERENCES locations(id),
  dest_location_id   INTEGER NOT NULL REFERENCES locations(id),
  scheduled_date     TEXT NOT NULL,
  packed_at          TEXT,
  reason             TEXT,
  note               TEXT,
  created_by         INTEGER REFERENCES users(id),
  created_at         TEXT NOT NULL,
  done_at            TEXT,
  CHECK (source_location_id <> dest_location_id),
  CHECK ((status = 'done') = (done_at IS NOT NULL))
);
CREATE INDEX idx_operations_type_status ON operations(type, status);
CREATE INDEX idx_operations_scheduled ON operations(scheduled_date);

CREATE TABLE operation_lines (
  id           INTEGER PRIMARY KEY,
  operation_id INTEGER NOT NULL REFERENCES operations(id) ON DELETE CASCADE,
  product_id   INTEGER NOT NULL REFERENCES products(id),
  qty          REAL NOT NULL CHECK (qty >= 0),
  picked       INTEGER NOT NULL DEFAULT 0 CHECK (picked IN (0,1)),
  system_qty   REAL
);
CREATE INDEX idx_lines_operation ON operation_lines(operation_id);
CREATE INDEX idx_lines_product ON operation_lines(product_id);

CREATE TABLE stock_moves (
  id               INTEGER PRIMARY KEY,
  operation_id     INTEGER NOT NULL REFERENCES operations(id),
  product_id       INTEGER NOT NULL REFERENCES products(id),
  from_location_id INTEGER NOT NULL REFERENCES locations(id),
  to_location_id   INTEGER NOT NULL REFERENCES locations(id),
  qty              REAL NOT NULL CHECK (qty > 0),
  unit_cost        REAL NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL,
  CHECK (from_location_id <> to_location_id)
);
CREATE INDEX idx_moves_product_to ON stock_moves(product_id, to_location_id);
CREATE INDEX idx_moves_product_from ON stock_moves(product_id, from_location_id);
CREATE INDEX idx_moves_created ON stock_moves(created_at);
-- Dashboard aggregates filter by virtual counter-party + date ("outbound to customers, last 30 days").
CREATE INDEX idx_moves_to_created ON stock_moves(to_location_id, created_at);
CREATE INDEX idx_moves_from_created ON stock_moves(from_location_id, created_at);
CREATE INDEX idx_moves_operation ON stock_moves(operation_id);

-- The ledger is append-only: corrections are new adjustment moves, never edits.
CREATE TRIGGER stock_moves_no_update BEFORE UPDATE ON stock_moves
BEGIN SELECT RAISE(ABORT, 'stock_moves is append-only'); END;
CREATE TRIGGER stock_moves_no_delete BEFORE DELETE ON stock_moves
BEGIN SELECT RAISE(ABORT, 'stock_moves is append-only'); END;

-- Done documents are immutable.
CREATE TRIGGER operations_done_immutable BEFORE UPDATE ON operations
WHEN OLD.status = 'done'
BEGIN SELECT RAISE(ABORT, 'done operations are immutable'); END;
CREATE TRIGGER lines_done_immutable_update BEFORE UPDATE ON operation_lines
WHEN (SELECT status FROM operations WHERE id = OLD.operation_id) = 'done'
BEGIN SELECT RAISE(ABORT, 'lines of done operations are immutable'); END;
CREATE TRIGGER lines_done_immutable_delete BEFORE DELETE ON operation_lines
WHEN (SELECT status FROM operations WHERE id = OLD.operation_id) = 'done'
BEGIN SELECT RAISE(ABORT, 'lines of done operations are immutable'); END;

-- On-hand per product per location, derived from the ledger.
CREATE VIEW stock_quants AS
SELECT product_id, location_id, ROUND(SUM(qty), 3) AS qty
FROM (
  SELECT product_id, to_location_id AS location_id, qty FROM stock_moves
  UNION ALL
  SELECT product_id, from_location_id AS location_id, -qty FROM stock_moves
)
GROUP BY product_id, location_id;

-- Same, restricted to real shelves/floors (what "on hand" means to a user).
CREATE VIEW internal_quants AS
SELECT q.product_id, q.location_id, l.warehouse_id, q.qty
FROM stock_quants q
JOIN locations l ON l.id = q.location_id AND l.kind = 'internal';

-- Human-readable location names ("HYD/Rack A", "Partners/Vendors") for reads and reports.
CREATE VIEW location_names AS
SELECT l.id, l.warehouse_id, l.kind, l.name, w.code AS warehouse_code,
  CASE l.kind
    WHEN 'internal' THEN w.code || '/' || l.name
    WHEN 'adjustment' THEN 'Virtual/' || l.name
    ELSE 'Partners/' || l.name
  END AS full_name
FROM locations l LEFT JOIN warehouses w ON w.id = l.warehouse_id;
`
