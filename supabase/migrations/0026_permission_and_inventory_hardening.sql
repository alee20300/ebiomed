-- Runtime permission checks and inventory ledger hardening.

DROP POLICY IF EXISTS "Permission grants readable by owner" ON ebiomed.permission_grants;
CREATE POLICY "Permission grants readable by owner" ON ebiomed.permission_grants
  FOR SELECT USING (
    auth.role() = 'authenticated' AND profile_id = auth.uid()
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_permission_grants_unique_global
  ON ebiomed.permission_grants(profile_id, action, resource, scope_type)
  WHERE scope_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_permission_grants_unique_scoped
  ON ebiomed.permission_grants(profile_id, action, resource, scope_type, scope_id)
  WHERE scope_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_parts_usage_restore ON ebiomed.parts_usage;
DROP TRIGGER IF EXISTS trg_parts_usage_decrement ON ebiomed.parts_usage;

CREATE OR REPLACE FUNCTION ebiomed.trg_parts_usage_inventory()
RETURNS trigger AS $$
DECLARE
  v_location_id uuid;
  v_bin_code text;
BEGIN
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
    NEW.work_order_id,
    NULL,
    NULL,
    'parts_usage',
    COALESCE(NEW.reason, 'Work order parts usage')
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
CREATE TRIGGER trg_parts_usage_inventory
  AFTER INSERT ON ebiomed.parts_usage
  FOR EACH ROW EXECUTE FUNCTION ebiomed.trg_parts_usage_inventory();
