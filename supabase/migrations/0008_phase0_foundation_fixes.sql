-- Phase 0: Foundation Fixes
-- 1. Fix wo_comments FK referencing wrong schema
-- 2. Fix trigger functions to use ebiomed schema
-- 3. Add updated_at columns and triggers to all tables
-- 4. Harden public RLS policies
-- 5. Add soft-delete (deleted_at) columns and RLS filters
-- 6. Grant table access for proper API exposure

-- ============================================================
-- 1. Fix wo_comments FK (was referencing public.profiles, should be ebiomed.profiles)
-- ============================================================
ALTER TABLE ebiomed.wo_comments DROP CONSTRAINT IF EXISTS wo_comments_author_id_fkey;
ALTER TABLE ebiomed.wo_comments
  ADD CONSTRAINT wo_comments_author_id_fkey
  FOREIGN KEY (author_id) REFERENCES ebiomed.profiles(id) ON DELETE CASCADE;

-- ============================================================
-- 2. Fix trigger functions to live in ebiomed schema
--    (originally created unqualified, landed in public)
-- ============================================================
DROP TRIGGER IF EXISTS trg_parts_usage_restore ON ebiomed.parts_usage;
DROP TRIGGER IF EXISTS trg_parts_usage_decrement ON ebiomed.parts_usage;
DROP FUNCTION IF EXISTS restore_part_quantity();
DROP FUNCTION IF EXISTS decrement_part_quantity();

CREATE OR REPLACE FUNCTION ebiomed.decrement_part_quantity()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE ebiomed.parts
  SET quantity_on_hand = quantity_on_hand - NEW.quantity_used,
      updated_at = now()
  WHERE id = NEW.part_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_parts_usage_decrement
  AFTER INSERT ON ebiomed.parts_usage
  FOR EACH ROW EXECUTE FUNCTION ebiomed.decrement_part_quantity();

CREATE OR REPLACE FUNCTION ebiomed.restore_part_quantity()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE ebiomed.parts
  SET quantity_on_hand = quantity_on_hand + OLD.quantity_used,
      updated_at = now()
  WHERE id = OLD.part_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_parts_usage_restore
  AFTER DELETE ON ebiomed.parts_usage
  FOR EACH ROW EXECUTE FUNCTION ebiomed.restore_part_quantity();

-- ============================================================
-- 3a. Add updated_at columns to tables missing them
-- ============================================================
ALTER TABLE ebiomed.work_orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE ebiomed.wo_comments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE ebiomed.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE ebiomed.departments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE ebiomed.viewer_departments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE ebiomed.checklist_templates ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE ebiomed.checklist_submissions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE ebiomed.pm_schedules ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE ebiomed.parts_usage ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- ============================================================
-- 3b. Create generic updated_at trigger and apply to all tables
-- ============================================================
CREATE OR REPLACE FUNCTION ebiomed.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT table_name
    FROM information_schema.columns
    WHERE table_schema = 'ebiomed'
      AND column_name = 'updated_at'
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%s_updated_at ON ebiomed.%I;',
      tbl, tbl
    );
    EXECUTE format(
      'CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON ebiomed.%I FOR EACH ROW EXECUTE FUNCTION ebiomed.update_updated_at_column();',
      tbl, tbl
    );
  END LOOP;
END;
$$;

-- ============================================================
-- 4. Harden public RLS policies
--    Remove overly broad USING (true) policies, replace with scoped ones
-- ============================================================

-- Equipment: replace broad public SELECT with scoped (active/under_repair only)
DROP POLICY IF EXISTS "Equipment viewable by public" ON ebiomed.equipment;
CREATE POLICY "Equipment viewable by public (scoped)" ON ebiomed.equipment
  FOR SELECT USING (status IN ('active', 'under_repair'));

-- Checklist submissions: remove public SELECT (submissions may contain private data)
DROP POLICY IF EXISTS "Checklist submissions viewable by public" ON ebiomed.checklist_submissions;

-- ============================================================
-- 5a. Add soft-delete columns
-- ============================================================
ALTER TABLE ebiomed.equipment ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE ebiomed.work_orders ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE ebiomed.pm_schedules ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE ebiomed.parts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- ============================================================
-- 5b. Add WHERE deleted_at IS NULL to RLS SELECT policies
--     (recreate policies that need the filter)
-- ============================================================

-- Equipment: authenticated SELECT
DROP POLICY IF EXISTS "Equipment viewable by authenticated" ON ebiomed.equipment;
CREATE POLICY "Equipment viewable by authenticated" ON ebiomed.equipment
  FOR SELECT USING (auth.role() = 'authenticated' AND deleted_at IS NULL);

-- Equipment: public SELECT (recreate with scoped + soft-delete filter)
DROP POLICY IF EXISTS "Equipment viewable by public (scoped)" ON ebiomed.equipment;
CREATE POLICY "Equipment viewable by public (scoped)" ON ebiomed.equipment
  FOR SELECT USING (deleted_at IS NULL AND status IN ('active', 'under_repair'));

-- Work Orders: authenticated SELECT
DROP POLICY IF EXISTS "WO viewable by authenticated" ON ebiomed.work_orders;
CREATE POLICY "WO viewable by authenticated" ON ebiomed.work_orders
  FOR SELECT USING (auth.role() = 'authenticated' AND deleted_at IS NULL);

-- PM Schedules: authenticated SELECT
DROP POLICY IF EXISTS "PM viewable by authenticated" ON ebiomed.pm_schedules;
CREATE POLICY "PM viewable by authenticated" ON ebiomed.pm_schedules
  FOR SELECT USING (auth.role() = 'authenticated' AND deleted_at IS NULL);

-- Parts: authenticated SELECT
DROP POLICY IF EXISTS "Parts viewable by authenticated" ON ebiomed.parts;
CREATE POLICY "Parts viewable by authenticated" ON ebiomed.parts
  FOR SELECT USING (auth.role() = 'authenticated' AND deleted_at IS NULL);

-- ============================================================
-- 6. Grant schema and table access for proper API exposure
--    (ebiomed schema was missing from config.toml api.schemas)
-- ============================================================
GRANT USAGE ON SCHEMA ebiomed TO anon, authenticated, service_role;

GRANT SELECT ON ebiomed.profiles TO authenticated;
GRANT UPDATE ON ebiomed.profiles TO authenticated;

GRANT SELECT ON ebiomed.equipment TO anon, authenticated;
GRANT INSERT, UPDATE ON ebiomed.equipment TO authenticated;

GRANT SELECT ON ebiomed.work_orders TO authenticated;
GRANT INSERT, UPDATE ON ebiomed.work_orders TO authenticated;

GRANT SELECT ON ebiomed.pm_schedules TO authenticated;
GRANT INSERT, UPDATE ON ebiomed.pm_schedules TO authenticated;

GRANT SELECT ON ebiomed.parts TO authenticated;
GRANT INSERT, UPDATE ON ebiomed.parts TO authenticated;

GRANT SELECT ON ebiomed.parts_usage TO authenticated;
GRANT INSERT ON ebiomed.parts_usage TO authenticated;

GRANT SELECT ON ebiomed.wo_comments TO authenticated;
GRANT INSERT ON ebiomed.wo_comments TO authenticated;

GRANT SELECT ON ebiomed.departments TO authenticated;
GRANT INSERT, DELETE ON ebiomed.departments TO authenticated;

GRANT SELECT ON ebiomed.viewer_departments TO authenticated;
GRANT INSERT, DELETE ON ebiomed.viewer_departments TO authenticated;

GRANT SELECT ON ebiomed.checklist_templates TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON ebiomed.checklist_templates TO authenticated;

GRANT SELECT, INSERT ON ebiomed.checklist_submissions TO anon;
GRANT SELECT ON ebiomed.checklist_submissions TO authenticated;
