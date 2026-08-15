-- Phases 8-10: inventory depth, enterprise scoping, imports, and integration scopes

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inventory_valuation_method' AND typnamespace = 'ebiomed'::regnamespace) THEN
    CREATE TYPE ebiomed.inventory_valuation_method AS ENUM ('standard_cost', 'fifo', 'weighted_average');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inventory_transaction_type' AND typnamespace = 'ebiomed'::regnamespace) THEN
    CREATE TYPE ebiomed.inventory_transaction_type AS ENUM ('receipt', 'usage', 'adjustment', 'cycle_count', 'transfer_in', 'transfer_out');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'permission_scope_type' AND typnamespace = 'ebiomed'::regnamespace) THEN
    CREATE TYPE ebiomed.permission_scope_type AS ENUM ('global', 'site', 'building', 'floor', 'room', 'department');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'import_status' AND typnamespace = 'ebiomed'::regnamespace) THEN
    CREATE TYPE ebiomed.import_status AS ENUM ('previewed', 'committed', 'rolled_back', 'failed');
  END IF;
END;
$$;

ALTER TABLE ebiomed.parts
  ADD COLUMN IF NOT EXISTS max_threshold integer,
  ADD COLUMN IF NOT EXISTS reorder_quantity integer,
  ADD COLUMN IF NOT EXISTS valuation_method ebiomed.inventory_valuation_method NOT NULL DEFAULT 'standard_cost',
  ADD COLUMN IF NOT EXISTS bin_code text;

UPDATE ebiomed.parts
SET
  max_threshold = COALESCE(max_threshold, GREATEST(min_threshold * 2, quantity_on_hand)),
  reorder_quantity = COALESCE(reorder_quantity, GREATEST(min_threshold, 1)),
  bin_code = COALESCE(bin_code, stock_location, location)
WHERE max_threshold IS NULL OR reorder_quantity IS NULL OR bin_code IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'parts_max_threshold_non_negative') THEN
    ALTER TABLE ebiomed.parts
      ADD CONSTRAINT parts_max_threshold_non_negative CHECK (max_threshold IS NULL OR max_threshold >= 0) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'parts_reorder_quantity_positive') THEN
    ALTER TABLE ebiomed.parts
      ADD CONSTRAINT parts_reorder_quantity_positive CHECK (reorder_quantity IS NULL OR reorder_quantity > 0) NOT VALID;
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS ebiomed.stock_locations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  site text,
  building text,
  floor text,
  room text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ebiomed.part_stock_balances (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  part_id uuid NOT NULL REFERENCES ebiomed.parts(id) ON DELETE CASCADE,
  stock_location_id uuid NOT NULL REFERENCES ebiomed.stock_locations(id) ON DELETE RESTRICT,
  bin_code text,
  quantity_on_hand integer NOT NULL DEFAULT 0 CHECK (quantity_on_hand >= 0),
  min_threshold integer NOT NULL DEFAULT 0 CHECK (min_threshold >= 0),
  max_threshold integer CHECK (max_threshold IS NULL OR max_threshold >= 0),
  reorder_quantity integer CHECK (reorder_quantity IS NULL OR reorder_quantity > 0),
  unit_cost decimal(10,2) CHECK (unit_cost IS NULL OR unit_cost >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (part_id, stock_location_id, bin_code)
);

CREATE TABLE IF NOT EXISTS ebiomed.inventory_transactions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  part_id uuid NOT NULL REFERENCES ebiomed.parts(id) ON DELETE RESTRICT,
  stock_location_id uuid REFERENCES ebiomed.stock_locations(id) ON DELETE RESTRICT,
  bin_code text,
  transaction_type ebiomed.inventory_transaction_type NOT NULL,
  quantity_delta integer NOT NULL,
  unit_cost decimal(10,2) CHECK (unit_cost IS NULL OR unit_cost >= 0),
  work_order_id uuid REFERENCES ebiomed.work_orders(id) ON DELETE SET NULL,
  job_card_id uuid REFERENCES ebiomed.job_cards(id) ON DELETE SET NULL,
  job_card_part_id uuid REFERENCES ebiomed.job_card_parts(id) ON DELETE SET NULL,
  purchase_order_line_id uuid REFERENCES ebiomed.purchase_order_lines(id) ON DELETE SET NULL,
  related_transaction_id uuid REFERENCES ebiomed.inventory_transactions(id) ON DELETE SET NULL,
  reference text,
  reason text NOT NULL,
  counted_quantity integer,
  recorded_by uuid REFERENCES ebiomed.profiles(id),
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ebiomed.stock_adjustments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  part_id uuid NOT NULL REFERENCES ebiomed.parts(id) ON DELETE RESTRICT,
  stock_location_id uuid REFERENCES ebiomed.stock_locations(id) ON DELETE RESTRICT,
  bin_code text,
  quantity_delta integer NOT NULL,
  reason text NOT NULL,
  transaction_id uuid REFERENCES ebiomed.inventory_transactions(id) ON DELETE SET NULL,
  adjusted_by uuid REFERENCES ebiomed.profiles(id),
  adjusted_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ebiomed.cycle_counts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  count_number text NOT NULL UNIQUE DEFAULT ('CC-' || upper(substr(uuid_generate_v4()::text, 1, 8))),
  part_id uuid NOT NULL REFERENCES ebiomed.parts(id) ON DELETE RESTRICT,
  stock_location_id uuid REFERENCES ebiomed.stock_locations(id) ON DELETE RESTRICT,
  bin_code text,
  expected_quantity integer NOT NULL CHECK (expected_quantity >= 0),
  counted_quantity integer NOT NULL CHECK (counted_quantity >= 0),
  variance integer NOT NULL,
  reason text NOT NULL,
  transaction_id uuid REFERENCES ebiomed.inventory_transactions(id) ON DELETE SET NULL,
  counted_by uuid REFERENCES ebiomed.profiles(id),
  counted_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ebiomed.stock_transfers (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  transfer_number text NOT NULL UNIQUE DEFAULT ('ST-' || upper(substr(uuid_generate_v4()::text, 1, 8))),
  part_id uuid NOT NULL REFERENCES ebiomed.parts(id) ON DELETE RESTRICT,
  from_stock_location_id uuid NOT NULL REFERENCES ebiomed.stock_locations(id) ON DELETE RESTRICT,
  to_stock_location_id uuid NOT NULL REFERENCES ebiomed.stock_locations(id) ON DELETE RESTRICT,
  from_bin_code text,
  to_bin_code text,
  quantity integer NOT NULL CHECK (quantity > 0),
  reason text NOT NULL,
  out_transaction_id uuid REFERENCES ebiomed.inventory_transactions(id) ON DELETE SET NULL,
  in_transaction_id uuid REFERENCES ebiomed.inventory_transactions(id) ON DELETE SET NULL,
  transferred_by uuid REFERENCES ebiomed.profiles(id),
  transferred_at timestamptz NOT NULL DEFAULT now(),
  CHECK (from_stock_location_id <> to_stock_location_id OR COALESCE(from_bin_code, '') <> COALESCE(to_bin_code, ''))
);

CREATE TABLE IF NOT EXISTS ebiomed.supplier_price_history (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  part_id uuid NOT NULL REFERENCES ebiomed.parts(id) ON DELETE CASCADE,
  vendor_id uuid REFERENCES ebiomed.vendors(id) ON DELETE SET NULL,
  supplier_name text,
  unit_price decimal(10,2) NOT NULL CHECK (unit_price >= 0),
  lead_time_days integer CHECK (lead_time_days IS NULL OR lead_time_days >= 0),
  source text NOT NULL DEFAULT 'manual',
  effective_at timestamptz NOT NULL DEFAULT now(),
  recorded_by uuid REFERENCES ebiomed.profiles(id),
  notes text
);

INSERT INTO ebiomed.stock_locations (code, name)
SELECT DISTINCT COALESCE(NULLIF(stock_location, ''), NULLIF(location, ''), 'MAIN'), COALESCE(NULLIF(stock_location, ''), NULLIF(location, ''), 'Main Stores')
FROM ebiomed.parts
ON CONFLICT (code) DO NOTHING;

INSERT INTO ebiomed.part_stock_balances (part_id, stock_location_id, bin_code, quantity_on_hand, min_threshold, max_threshold, reorder_quantity, unit_cost)
SELECT p.id, sl.id, p.bin_code, p.quantity_on_hand, p.min_threshold, p.max_threshold, p.reorder_quantity, p.unit_cost
FROM ebiomed.parts p
JOIN ebiomed.stock_locations sl ON sl.code = COALESCE(NULLIF(p.stock_location, ''), NULLIF(p.location, ''), 'MAIN')
ON CONFLICT (part_id, stock_location_id, bin_code) DO NOTHING;

CREATE TABLE IF NOT EXISTS ebiomed.sites (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL UNIQUE,
  code text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ebiomed.buildings (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id uuid NOT NULL REFERENCES ebiomed.sites(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_id, name)
);

CREATE TABLE IF NOT EXISTS ebiomed.floors (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  building_id uuid NOT NULL REFERENCES ebiomed.buildings(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (building_id, name)
);

CREATE TABLE IF NOT EXISTS ebiomed.rooms (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  floor_id uuid NOT NULL REFERENCES ebiomed.floors(id) ON DELETE CASCADE,
  name text NOT NULL,
  department_id uuid REFERENCES ebiomed.departments(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (floor_id, name)
);

ALTER TABLE ebiomed.equipment
  ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES ebiomed.sites(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS building_id uuid REFERENCES ebiomed.buildings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS floor_id uuid REFERENCES ebiomed.floors(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS room_id uuid REFERENCES ebiomed.rooms(id) ON DELETE SET NULL;

ALTER TABLE ebiomed.departments
  ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES ebiomed.sites(id) ON DELETE SET NULL;

ALTER TABLE ebiomed.profiles
  ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES ebiomed.sites(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES ebiomed.departments(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS ebiomed.permission_grants (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id uuid NOT NULL REFERENCES ebiomed.profiles(id) ON DELETE CASCADE,
  action text NOT NULL,
  resource text NOT NULL,
  scope_type ebiomed.permission_scope_type NOT NULL DEFAULT 'global',
  scope_id uuid,
  granted boolean NOT NULL DEFAULT true,
  reason text NOT NULL,
  created_by uuid REFERENCES ebiomed.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, action, resource, scope_type, scope_id)
);

CREATE TABLE IF NOT EXISTS ebiomed.permission_audit (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  permission_grant_id uuid REFERENCES ebiomed.permission_grants(id) ON DELETE SET NULL,
  profile_id uuid NOT NULL REFERENCES ebiomed.profiles(id) ON DELETE CASCADE,
  action text NOT NULL,
  resource text NOT NULL,
  scope_type ebiomed.permission_scope_type NOT NULL,
  scope_id uuid,
  old_granted boolean,
  new_granted boolean,
  changed_by uuid REFERENCES ebiomed.profiles(id),
  reason text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ebiomed.api_keys
  ADD COLUMN IF NOT EXISTS scopes text[] NOT NULL DEFAULT ARRAY['read:*'],
  ADD COLUMN IF NOT EXISTS allowed_resources text[] NOT NULL DEFAULT ARRAY['*'];

CREATE TABLE IF NOT EXISTS ebiomed.import_batches (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  template text NOT NULL,
  filename text,
  status ebiomed.import_status NOT NULL DEFAULT 'previewed',
  total_rows integer NOT NULL DEFAULT 0,
  valid_rows integer NOT NULL DEFAULT 0,
  duplicate_rows integer NOT NULL DEFAULT 0,
  error_rows integer NOT NULL DEFAULT 0,
  preview jsonb NOT NULL DEFAULT '[]'::jsonb,
  errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  duplicate_matches jsonb NOT NULL DEFAULT '[]'::jsonb,
  rollback_payload jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid REFERENCES ebiomed.profiles(id),
  committed_by uuid REFERENCES ebiomed.profiles(id),
  committed_at timestamptz,
  rolled_back_by uuid REFERENCES ebiomed.profiles(id),
  rolled_back_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ebiomed.notification_adapters (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  adapter text NOT NULL UNIQUE,
  enabled boolean NOT NULL DEFAULT false,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO ebiomed.notification_adapters (adapter, enabled, config)
VALUES
  ('email', false, '{"provider":"smtp","from":"","reply_to":""}'::jsonb),
  ('sms', false, '{"provider":"","sender_id":""}'::jsonb),
  ('whatsapp', false, '{"provider":"","business_number":""}'::jsonb)
ON CONFLICT (adapter) DO NOTHING;

INSERT INTO ebiomed.app_settings (key, value)
VALUES
  ('sso_oidc_enabled', 'false'::jsonb),
  ('sso_oidc_config', '{"issuer":"","client_id":"","scopes":["openid","email","profile"]}'::jsonb),
  ('sso_saml_status', '"planned"'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE VIEW ebiomed.inventory_value_report AS
SELECT
  p.id AS part_id,
  p.name,
  p.part_number,
  COALESCE(sl.name, p.stock_location, p.location, 'Main Stores') AS stock_location,
  COALESCE(psb.bin_code, p.bin_code) AS bin_code,
  COALESCE(psb.quantity_on_hand, p.quantity_on_hand) AS quantity_on_hand,
  COALESCE(psb.unit_cost, p.unit_cost, 0)::numeric(12,2) AS unit_cost,
  (COALESCE(psb.quantity_on_hand, p.quantity_on_hand) * COALESCE(psb.unit_cost, p.unit_cost, 0))::numeric(12,2) AS inventory_value,
  p.valuation_method
FROM ebiomed.parts p
LEFT JOIN ebiomed.part_stock_balances psb ON psb.part_id = p.id
LEFT JOIN ebiomed.stock_locations sl ON sl.id = psb.stock_location_id
WHERE p.deleted_at IS NULL;

CREATE OR REPLACE VIEW ebiomed.low_stock_report AS
SELECT
  p.id AS part_id,
  p.name,
  p.part_number,
  COALESCE(sl.name, p.stock_location, p.location, 'Main Stores') AS stock_location,
  COALESCE(psb.bin_code, p.bin_code) AS bin_code,
  COALESCE(psb.quantity_on_hand, p.quantity_on_hand) AS quantity_on_hand,
  COALESCE(psb.min_threshold, p.min_threshold) AS min_threshold,
  COALESCE(psb.max_threshold, p.max_threshold) AS max_threshold,
  COALESCE(psb.reorder_quantity, p.reorder_quantity, GREATEST(COALESCE(psb.min_threshold, p.min_threshold) * 2 - COALESCE(psb.quantity_on_hand, p.quantity_on_hand), 1)) AS reorder_quantity,
  p.preferred_vendor_id,
  p.vendor_price,
  p.lead_time_days
FROM ebiomed.parts p
LEFT JOIN ebiomed.part_stock_balances psb ON psb.part_id = p.id
LEFT JOIN ebiomed.stock_locations sl ON sl.id = psb.stock_location_id
WHERE p.deleted_at IS NULL
  AND COALESCE(psb.quantity_on_hand, p.quantity_on_hand) <= COALESCE(psb.min_threshold, p.min_threshold);

CREATE OR REPLACE VIEW ebiomed.parts_usage_report AS
SELECT
  it.id AS transaction_id,
  it.part_id,
  p.name AS part_name,
  p.part_number,
  abs(it.quantity_delta) AS quantity_used,
  COALESCE(it.unit_cost, p.unit_cost, 0)::numeric(10,2) AS unit_cost,
  (abs(it.quantity_delta) * COALESCE(it.unit_cost, p.unit_cost, 0))::numeric(12,2) AS usage_cost,
  it.work_order_id,
  wo.equipment_id,
  eq.name AS equipment_name,
  eq.tag_number,
  eq.department,
  it.job_card_id,
  it.recorded_at
FROM ebiomed.inventory_transactions it
JOIN ebiomed.parts p ON p.id = it.part_id
LEFT JOIN ebiomed.work_orders wo ON wo.id = it.work_order_id
LEFT JOIN ebiomed.equipment eq ON eq.id = wo.equipment_id
WHERE it.transaction_type = 'usage';

CREATE OR REPLACE VIEW ebiomed.reorder_suggestions AS
SELECT
  lsr.*,
  v.name AS vendor_name,
  (lsr.reorder_quantity * COALESCE(lsr.vendor_price, latest_price.unit_price, 0))::numeric(12,2) AS estimated_cost,
  latest_price.unit_price AS latest_supplier_price,
  latest_price.effective_at AS latest_supplier_price_at
FROM ebiomed.low_stock_report lsr
LEFT JOIN ebiomed.vendors v ON v.id = lsr.preferred_vendor_id
LEFT JOIN LATERAL (
  SELECT sph.unit_price, sph.effective_at
  FROM ebiomed.supplier_price_history sph
  WHERE sph.part_id = lsr.part_id
    AND (sph.vendor_id = lsr.preferred_vendor_id OR lsr.preferred_vendor_id IS NULL)
  ORDER BY sph.effective_at DESC
  LIMIT 1
) latest_price ON true;

CREATE OR REPLACE FUNCTION ebiomed.sync_part_quantity_from_balances(p_part_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE ebiomed.parts
  SET quantity_on_hand = COALESCE((SELECT SUM(quantity_on_hand) FROM ebiomed.part_stock_balances WHERE part_id = p_part_id), quantity_on_hand),
      updated_at = now()
  WHERE id = p_part_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION ebiomed.apply_inventory_transaction(
  p_part_id uuid,
  p_stock_location_id uuid,
  p_bin_code text,
  p_transaction_type ebiomed.inventory_transaction_type,
  p_quantity_delta integer,
  p_unit_cost numeric,
  p_work_order_id uuid,
  p_job_card_id uuid,
  p_job_card_part_id uuid,
  p_reference text,
  p_reason text
) RETURNS uuid AS $$
DECLARE
  v_transaction_id uuid;
BEGIN
  INSERT INTO ebiomed.inventory_transactions (
    part_id, stock_location_id, bin_code, transaction_type, quantity_delta, unit_cost,
    work_order_id, job_card_id, job_card_part_id, reference, reason, recorded_by
  )
  VALUES (
    p_part_id, p_stock_location_id, p_bin_code, p_transaction_type, p_quantity_delta, p_unit_cost,
    p_work_order_id, p_job_card_id, p_job_card_part_id, p_reference, p_reason, auth.uid()
  )
  RETURNING id INTO v_transaction_id;

  IF p_stock_location_id IS NOT NULL THEN
    INSERT INTO ebiomed.part_stock_balances (part_id, stock_location_id, bin_code, quantity_on_hand, unit_cost)
    VALUES (p_part_id, p_stock_location_id, p_bin_code, GREATEST(p_quantity_delta, 0), p_unit_cost)
    ON CONFLICT (part_id, stock_location_id, bin_code) DO UPDATE
    SET quantity_on_hand = GREATEST(ebiomed.part_stock_balances.quantity_on_hand + p_quantity_delta, 0),
        unit_cost = COALESCE(EXCLUDED.unit_cost, ebiomed.part_stock_balances.unit_cost),
        updated_at = now();
  END IF;

  UPDATE ebiomed.parts
  SET quantity_on_hand = GREATEST(quantity_on_hand + p_quantity_delta, 0),
      unit_cost = COALESCE(p_unit_cost, unit_cost),
      updated_at = now()
  WHERE id = p_part_id;

  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION ebiomed.trg_job_card_part_inventory()
RETURNS trigger AS $$
DECLARE
  v_work_order_id uuid;
  v_location_id uuid;
  v_bin_code text;
BEGIN
  SELECT jc.work_order_id INTO v_work_order_id
  FROM ebiomed.job_cards jc
  WHERE jc.id = NEW.job_card_id;

  SELECT psb.stock_location_id, psb.bin_code INTO v_location_id, v_bin_code
  FROM ebiomed.part_stock_balances psb
  WHERE psb.part_id = NEW.part_id
  ORDER BY psb.quantity_on_hand DESC, psb.updated_at DESC
  LIMIT 1;

  PERFORM ebiomed.apply_inventory_transaction(
    NEW.part_id,
    v_location_id,
    v_bin_code,
    'usage',
    -NEW.quantity_used,
    NULL,
    v_work_order_id,
    NEW.job_card_id,
    NEW.id,
    'job_card_parts',
    'Job card parts usage'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_job_card_parts_inventory ON ebiomed.job_card_parts;
CREATE TRIGGER trg_job_card_parts_inventory
  AFTER INSERT ON ebiomed.job_card_parts
  FOR EACH ROW EXECUTE FUNCTION ebiomed.trg_job_card_part_inventory();

CREATE OR REPLACE FUNCTION ebiomed.trg_vendor_pricing_history()
RETURNS trigger AS $$
BEGIN
  INSERT INTO ebiomed.supplier_price_history (part_id, vendor_id, unit_price, lead_time_days, source)
  VALUES (NEW.part_id, NEW.vendor_id, NEW.unit_price, NEW.lead_time_days, 'vendor_part_pricing');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_vendor_pricing_history ON ebiomed.vendor_part_pricing;
CREATE TRIGGER trg_vendor_pricing_history
  AFTER INSERT OR UPDATE OF unit_price, lead_time_days ON ebiomed.vendor_part_pricing
  FOR EACH ROW EXECUTE FUNCTION ebiomed.trg_vendor_pricing_history();

CREATE INDEX IF NOT EXISTS idx_inventory_transactions_part ON ebiomed.inventory_transactions(part_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_wo ON ebiomed.inventory_transactions(work_order_id);
CREATE INDEX IF NOT EXISTS idx_part_stock_balances_part ON ebiomed.part_stock_balances(part_id);
CREATE INDEX IF NOT EXISTS idx_permission_grants_profile ON ebiomed.permission_grants(profile_id);
CREATE INDEX IF NOT EXISTS idx_permission_audit_profile ON ebiomed.permission_audit(profile_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_keys_scopes ON ebiomed.api_keys USING gin(scopes);

ALTER TABLE ebiomed.stock_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ebiomed.part_stock_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE ebiomed.inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ebiomed.stock_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ebiomed.cycle_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ebiomed.stock_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE ebiomed.supplier_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE ebiomed.sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE ebiomed.buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ebiomed.floors ENABLE ROW LEVEL SECURITY;
ALTER TABLE ebiomed.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE ebiomed.permission_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE ebiomed.permission_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE ebiomed.import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE ebiomed.notification_adapters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Inventory reference readable by authenticated" ON ebiomed.stock_locations FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Stock balances readable by authenticated" ON ebiomed.part_stock_balances FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Inventory transactions readable by authenticated" ON ebiomed.inventory_transactions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Inventory managed by admin technician" ON ebiomed.inventory_transactions FOR INSERT WITH CHECK (
  auth.role() = 'authenticated' AND EXISTS (SELECT 1 FROM ebiomed.profiles WHERE id = auth.uid() AND role IN ('admin', 'technician'))
);
CREATE POLICY "Stock adjustments managed by admin technician" ON ebiomed.stock_adjustments FOR ALL USING (
  auth.role() = 'authenticated' AND EXISTS (SELECT 1 FROM ebiomed.profiles WHERE id = auth.uid() AND role IN ('admin', 'technician'))
);
CREATE POLICY "Cycle counts managed by admin technician" ON ebiomed.cycle_counts FOR ALL USING (
  auth.role() = 'authenticated' AND EXISTS (SELECT 1 FROM ebiomed.profiles WHERE id = auth.uid() AND role IN ('admin', 'technician'))
);
CREATE POLICY "Transfers managed by admin technician" ON ebiomed.stock_transfers FOR ALL USING (
  auth.role() = 'authenticated' AND EXISTS (SELECT 1 FROM ebiomed.profiles WHERE id = auth.uid() AND role IN ('admin', 'technician'))
);
CREATE POLICY "Supplier price history readable by authenticated" ON ebiomed.supplier_price_history FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Supplier price history insertable by admin technician" ON ebiomed.supplier_price_history FOR INSERT WITH CHECK (
  auth.role() = 'authenticated' AND EXISTS (SELECT 1 FROM ebiomed.profiles WHERE id = auth.uid() AND role IN ('admin', 'technician'))
);
CREATE POLICY "Sites readable by authenticated" ON ebiomed.sites FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Buildings readable by authenticated" ON ebiomed.buildings FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Floors readable by authenticated" ON ebiomed.floors FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Rooms readable by authenticated" ON ebiomed.rooms FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Permission grants admin only" ON ebiomed.permission_grants FOR ALL USING (
  auth.role() = 'authenticated' AND EXISTS (SELECT 1 FROM ebiomed.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Permission audit admin only" ON ebiomed.permission_audit FOR SELECT USING (
  auth.role() = 'authenticated' AND EXISTS (SELECT 1 FROM ebiomed.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Import batches admin technician" ON ebiomed.import_batches FOR ALL USING (
  auth.role() = 'authenticated' AND EXISTS (SELECT 1 FROM ebiomed.profiles WHERE id = auth.uid() AND role IN ('admin', 'technician'))
);
CREATE POLICY "Notification adapters admin only" ON ebiomed.notification_adapters FOR ALL USING (
  auth.role() = 'authenticated' AND EXISTS (SELECT 1 FROM ebiomed.profiles WHERE id = auth.uid() AND role = 'admin')
);

GRANT SELECT ON ebiomed.inventory_value_report, ebiomed.low_stock_report, ebiomed.parts_usage_report, ebiomed.reorder_suggestions TO authenticated;
GRANT SELECT ON ebiomed.stock_locations, ebiomed.part_stock_balances, ebiomed.inventory_transactions, ebiomed.supplier_price_history TO authenticated;
GRANT SELECT, INSERT ON ebiomed.stock_adjustments, ebiomed.cycle_counts, ebiomed.stock_transfers TO authenticated;
GRANT SELECT, INSERT, UPDATE ON ebiomed.import_batches TO authenticated;
GRANT SELECT, INSERT, UPDATE ON ebiomed.notification_adapters TO authenticated;
GRANT SELECT, INSERT, UPDATE ON ebiomed.permission_grants TO authenticated;
GRANT SELECT ON ebiomed.permission_audit TO authenticated;
GRANT EXECUTE ON FUNCTION ebiomed.apply_inventory_transaction(uuid, uuid, text, ebiomed.inventory_transaction_type, integer, numeric, uuid, uuid, uuid, text, text) TO authenticated;
