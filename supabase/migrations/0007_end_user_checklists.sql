-- End-user checklist templates per equipment
CREATE TABLE ebiomed.checklist_templates (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  equipment_id uuid NOT NULL REFERENCES ebiomed.equipment(id) ON DELETE CASCADE,
  name text NOT NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  frequency text DEFAULT 'daily',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Submissions from end users
CREATE TABLE ebiomed.checklist_submissions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  equipment_id uuid NOT NULL REFERENCES ebiomed.equipment(id) ON DELETE CASCADE,
  template_id uuid REFERENCES ebiomed.checklist_templates(id) ON DELETE SET NULL,
  items jsonb NOT NULL,
  notes text,
  submitted_by_name text,
  submitted_by_department text,
  work_order_id uuid REFERENCES ebiomed.work_orders(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_checklist_templates_equipment ON ebiomed.checklist_templates(equipment_id);
CREATE INDEX idx_checklist_submissions_equipment ON ebiomed.checklist_submissions(equipment_id, created_at DESC);

-- RLS for checklist templates
ALTER TABLE ebiomed.checklist_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Checklist templates viewable by authenticated" ON ebiomed.checklist_templates
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Checklist templates editable by admin or tech" ON ebiomed.checklist_templates
  FOR ALL USING (
    auth.uid() IS NOT NULL AND
    EXISTS (SELECT 1 FROM ebiomed.profiles WHERE id = auth.uid() AND role IN ('admin', 'technician'))
  );

-- RLS for checklist submissions
ALTER TABLE ebiomed.checklist_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Checklist submissions insertable by public" ON ebiomed.checklist_submissions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Checklist submissions viewable by authenticated" ON ebiomed.checklist_submissions
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Public access for end users (read templates, submit checklists)
CREATE POLICY "Checklist templates viewable by public" ON ebiomed.checklist_templates
  FOR SELECT USING (true);

CREATE POLICY "Checklist submissions viewable by public" ON ebiomed.checklist_submissions
  FOR SELECT USING (true);

-- Grant schema and table access
GRANT USAGE ON SCHEMA ebiomed TO anon, authenticated, service_role;
GRANT SELECT ON ebiomed.checklist_templates TO anon, authenticated;
GRANT SELECT, INSERT ON ebiomed.checklist_submissions TO anon;
GRANT ALL ON ebiomed.checklist_templates TO authenticated;
GRANT ALL ON ebiomed.checklist_submissions TO authenticated;
