-- Mobile technician flow: field photo evidence for work orders

CREATE TABLE IF NOT EXISTS ebiomed.work_order_photos (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  work_order_id uuid NOT NULL REFERENCES ebiomed.work_orders(id) ON DELETE CASCADE,
  photo_url text NOT NULL,
  caption text,
  uploaded_by uuid NOT NULL REFERENCES ebiomed.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_work_order_photos_work_order
  ON ebiomed.work_order_photos(work_order_id, created_at DESC);

ALTER TABLE ebiomed.work_order_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Work order photos viewable by authenticated" ON ebiomed.work_order_photos;
CREATE POLICY "Work order photos viewable by authenticated" ON ebiomed.work_order_photos
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Work order photos insertable by admin or technician" ON ebiomed.work_order_photos;
CREATE POLICY "Work order photos insertable by admin or technician" ON ebiomed.work_order_photos
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND
    uploaded_by = auth.uid() AND
    EXISTS (
      SELECT 1
      FROM ebiomed.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'technician')
    )
  );

GRANT SELECT, INSERT ON ebiomed.work_order_photos TO authenticated;
