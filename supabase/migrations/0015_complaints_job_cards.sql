-- Phase 2: Complaints, Job Cards, Expenses, and App Settings
-- Foundation migration for CMMS workflow: complaint → work order → job card → expense tracking

-- ============================================================
-- 1. New ENUMs
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'complaint_status' AND typnamespace = 'ebiomed'::regnamespace) THEN
    CREATE TYPE ebiomed.complaint_status AS ENUM ('pending_review', 'approved', 'rejected');
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_card_status' AND typnamespace = 'ebiomed'::regnamespace) THEN
    CREATE TYPE ebiomed.job_card_status AS ENUM ('in_progress', 'completed');
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'expense_category' AND typnamespace = 'ebiomed'::regnamespace) THEN
    CREATE TYPE ebiomed.expense_category AS ENUM ('food', 'ticket', 'accommodation');
  END IF;
END;
$$;

-- ============================================================
-- 2. complaints table
-- ============================================================
CREATE TABLE IF NOT EXISTS ebiomed.complaints (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  equipment_id uuid NOT NULL REFERENCES ebiomed.equipment(id) ON DELETE RESTRICT,
  description text NOT NULL,
  photo_url text,
  reported_by_name text,
  reported_by_department text,
  status ebiomed.complaint_status NOT NULL DEFAULT 'pending_review',
  reviewer_id uuid REFERENCES ebiomed.profiles(id),
  review_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

-- ============================================================
-- 3. job_cards table
-- ============================================================
CREATE TABLE IF NOT EXISTS ebiomed.job_cards (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  work_order_id uuid NOT NULL REFERENCES ebiomed.work_orders(id) ON DELETE RESTRICT,
  technician_id uuid NOT NULL REFERENCES ebiomed.profiles(id),
  status ebiomed.job_card_status NOT NULL DEFAULT 'in_progress',
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  summary text,
  unresolved_issues text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 4. job_card_entries (time log per job card)
-- ============================================================
CREATE TABLE IF NOT EXISTS ebiomed.job_card_entries (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_card_id uuid NOT NULL REFERENCES ebiomed.job_cards(id) ON DELETE CASCADE,
  description text NOT NULL,
  started_at timestamptz NOT NULL,
  ended_at timestamptz NOT NULL,
  duration_minutes integer NOT NULL
);

-- ============================================================
-- 5. job_card_parts (parts consumed per job card)
-- ============================================================
CREATE TABLE IF NOT EXISTS ebiomed.job_card_parts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_card_id uuid NOT NULL REFERENCES ebiomed.job_cards(id) ON DELETE CASCADE,
  part_id uuid NOT NULL REFERENCES ebiomed.parts(id) ON DELETE RESTRICT,
  quantity_used integer NOT NULL DEFAULT 1
);

-- ============================================================
-- 6. job_card_expenses (optional expense tracking)
-- ============================================================
CREATE TABLE IF NOT EXISTS ebiomed.job_card_expenses (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_card_id uuid NOT NULL REFERENCES ebiomed.job_cards(id) ON DELETE CASCADE,
  category ebiomed.expense_category NOT NULL,
  amount decimal(10,2) NOT NULL,
  description text NOT NULL,
  slip_url text
);

-- ============================================================
-- 7. app_settings (feature flags)
-- ============================================================
CREATE TABLE IF NOT EXISTS ebiomed.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_by uuid REFERENCES ebiomed.profiles(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Seed default settings
INSERT INTO ebiomed.app_settings (key, value) VALUES ('expense_tracking_enabled', 'false')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- 8. Add complaint_id to work_orders (links complaint to resulting work order)
-- ============================================================
ALTER TABLE ebiomed.work_orders ADD COLUMN IF NOT EXISTS complaint_id uuid REFERENCES ebiomed.complaints(id);

-- ============================================================
-- 9. updated_at triggers
-- ============================================================
DROP TRIGGER IF EXISTS trg_complaints_updated_at ON ebiomed.complaints;
CREATE TRIGGER trg_complaints_updated_at
  BEFORE UPDATE ON ebiomed.complaints
  FOR EACH ROW EXECUTE FUNCTION ebiomed.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_job_cards_updated_at ON ebiomed.job_cards;
CREATE TRIGGER trg_job_cards_updated_at
  BEFORE UPDATE ON ebiomed.job_cards
  FOR EACH ROW EXECUTE FUNCTION ebiomed.update_updated_at_column();

-- ============================================================
-- 10. Row Level Security
-- ============================================================

-- complaints
ALTER TABLE ebiomed.complaints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Complaints viewable by authenticated" ON ebiomed.complaints;
CREATE POLICY "Complaints viewable by authenticated" ON ebiomed.complaints
  FOR SELECT USING (auth.role() = 'authenticated' AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Complaints insertable by authenticated" ON ebiomed.complaints;
CREATE POLICY "Complaints insertable by authenticated" ON ebiomed.complaints
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Complaints updatable by admin or technician" ON ebiomed.complaints;
CREATE POLICY "Complaints updatable by admin or technician" ON ebiomed.complaints
  FOR UPDATE USING (
    auth.role() = 'authenticated' AND
    EXISTS (SELECT 1 FROM ebiomed.profiles WHERE id = auth.uid() AND role IN ('admin', 'technician'))
  );

-- job_cards
ALTER TABLE ebiomed.job_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Job cards viewable by authenticated" ON ebiomed.job_cards;
CREATE POLICY "Job cards viewable by authenticated" ON ebiomed.job_cards
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Job cards insertable by authenticated" ON ebiomed.job_cards;
CREATE POLICY "Job cards insertable by authenticated" ON ebiomed.job_cards
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Job cards updatable by admin or technician" ON ebiomed.job_cards;
CREATE POLICY "Job cards updatable by admin or technician" ON ebiomed.job_cards
  FOR UPDATE USING (
    auth.role() = 'authenticated' AND
    EXISTS (SELECT 1 FROM ebiomed.profiles WHERE id = auth.uid() AND role IN ('admin', 'technician'))
  );

-- job_card_entries
ALTER TABLE ebiomed.job_card_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Job card entries manageable by admin or technician" ON ebiomed.job_card_entries;
CREATE POLICY "Job card entries manageable by admin or technician" ON ebiomed.job_card_entries
  FOR ALL USING (
    auth.role() = 'authenticated' AND
    EXISTS (SELECT 1 FROM ebiomed.profiles WHERE id = auth.uid() AND role IN ('admin', 'technician'))
  );

-- job_card_parts
ALTER TABLE ebiomed.job_card_parts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Job card parts manageable by admin or technician" ON ebiomed.job_card_parts;
CREATE POLICY "Job card parts manageable by admin or technician" ON ebiomed.job_card_parts
  FOR ALL USING (
    auth.role() = 'authenticated' AND
    EXISTS (SELECT 1 FROM ebiomed.profiles WHERE id = auth.uid() AND role IN ('admin', 'technician'))
  );

-- job_card_expenses
ALTER TABLE ebiomed.job_card_expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Job card expenses manageable by admin or technician" ON ebiomed.job_card_expenses;
CREATE POLICY "Job card expenses manageable by admin or technician" ON ebiomed.job_card_expenses
  FOR ALL USING (
    auth.role() = 'authenticated' AND
    EXISTS (SELECT 1 FROM ebiomed.profiles WHERE id = auth.uid() AND role IN ('admin', 'technician'))
  );

-- RLS: app_settings (read all, write admin only)
ALTER TABLE ebiomed.app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "App settings readable by all" ON ebiomed.app_settings;
CREATE POLICY "App settings readable by all" ON ebiomed.app_settings
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "App settings writable by admin" ON ebiomed.app_settings;
CREATE POLICY "App settings writable by admin" ON ebiomed.app_settings
  FOR ALL USING (
    auth.role() = 'authenticated' AND
    EXISTS (SELECT 1 FROM ebiomed.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- 11. Grant permissions
-- ============================================================
GRANT SELECT, INSERT, UPDATE ON ebiomed.complaints TO authenticated;
GRANT SELECT, INSERT, UPDATE ON ebiomed.job_cards TO authenticated;
GRANT SELECT, INSERT ON ebiomed.job_card_entries TO authenticated;
GRANT SELECT, INSERT ON ebiomed.job_card_parts TO authenticated;
GRANT SELECT, INSERT ON ebiomed.job_card_expenses TO authenticated;
GRANT SELECT, INSERT, UPDATE ON ebiomed.app_settings TO authenticated;
