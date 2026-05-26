-- Enable RLS on all tables
ALTER TABLE ebiomed.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE ebiomed.equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE ebiomed.work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE ebiomed.pm_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE ebiomed.parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ebiomed.parts_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE ebiomed.wo_comments ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read all profiles, update their own
CREATE POLICY "Profiles are viewable by all authenticated users" ON ebiomed.profiles
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can update own profile" ON ebiomed.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Equipment: viewable by all authenticated, editable by admin/technician
CREATE POLICY "Equipment viewable by authenticated" ON ebiomed.equipment
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Equipment editable by admin or technician" ON ebiomed.equipment
  FOR ALL USING (
    auth.role() = 'authenticated' AND
    EXISTS (SELECT 1 FROM ebiomed.profiles WHERE id = auth.uid() AND role IN ('admin', 'technician'))
  );

-- Work Orders: viewable by all authenticated, editable by admin/technician or assignee
CREATE POLICY "WO viewable by authenticated" ON ebiomed.work_orders
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "WO editable by admin, technician, or assignee" ON ebiomed.work_orders
  FOR ALL USING (
    auth.role() = 'authenticated' AND
    (
      EXISTS (SELECT 1 FROM ebiomed.profiles WHERE id = auth.uid() AND role IN ('admin', 'technician'))
      OR assigned_to = auth.uid()
    )
  );

-- PM Schedules: viewable by all, editable by admin/technician
CREATE POLICY "PM viewable by authenticated" ON ebiomed.pm_schedules
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "PM editable by admin or technician" ON ebiomed.pm_schedules
  FOR ALL USING (
    auth.role() = 'authenticated' AND
    EXISTS (SELECT 1 FROM ebiomed.profiles WHERE id = auth.uid() AND role IN ('admin', 'technician'))
  );

-- Parts: viewable by all, editable by admin/technician
CREATE POLICY "Parts viewable by authenticated" ON ebiomed.parts
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Parts editable by admin or technician" ON ebiomed.parts
  FOR ALL USING (
    auth.role() = 'authenticated' AND
    EXISTS (SELECT 1 FROM ebiomed.profiles WHERE id = auth.uid() AND role IN ('admin', 'technician'))
  );

-- Parts Usage: viewable by all, insertable by technician/admin
CREATE POLICY "Parts usage viewable by authenticated" ON ebiomed.parts_usage
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Parts usage insertable by admin or technician" ON ebiomed.parts_usage
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND
    EXISTS (SELECT 1 FROM ebiomed.profiles WHERE id = auth.uid() AND role IN ('admin', 'technician'))
  );

-- Comments: viewable by all, insertable by authenticated
CREATE POLICY "Comments viewable by authenticated" ON ebiomed.wo_comments
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Comments insertable by authenticated" ON ebiomed.wo_comments
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Public access for equipment lookup (end-user checklist and fault reporting)
CREATE POLICY "Equipment viewable by public" ON ebiomed.equipment
  FOR SELECT USING (true);
