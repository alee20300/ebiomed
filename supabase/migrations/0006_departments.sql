-- Create departments lookup table
CREATE TABLE ebiomed.departments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create viewer-department junction table
CREATE TABLE ebiomed.viewer_departments (
  viewer_id uuid NOT NULL REFERENCES ebiomed.profiles(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES ebiomed.departments(id) ON DELETE CASCADE,
  PRIMARY KEY (viewer_id, department_id)
);

-- Seed departments from existing equipment.department and profiles.department
INSERT INTO ebiomed.departments (name)
SELECT DISTINCT department FROM ebiomed.equipment WHERE department IS NOT NULL
UNION
SELECT DISTINCT department FROM ebiomed.profiles WHERE department IS NOT NULL
ON CONFLICT (name) DO NOTHING;

-- Enable RLS
ALTER TABLE ebiomed.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ebiomed.viewer_departments ENABLE ROW LEVEL SECURITY;

-- Departments policies
CREATE POLICY "Departments viewable by authenticated" ON ebiomed.departments
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Departments editable by admin" ON ebiomed.departments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM ebiomed.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Viewer departments policies
CREATE POLICY "Viewer departments viewable by authenticated" ON ebiomed.viewer_departments
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Viewer departments editable by admin" ON ebiomed.viewer_departments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM ebiomed.profiles WHERE id = auth.uid() AND role = 'admin')
  );
