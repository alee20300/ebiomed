-- Generalized work order media evidence for technician workflows.

CREATE TABLE IF NOT EXISTS ebiomed.work_order_attachments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  work_order_id uuid NOT NULL REFERENCES ebiomed.work_orders(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_name text,
  mime_type text NOT NULL,
  media_type text NOT NULL CHECK (media_type IN ('image', 'video')),
  file_size_bytes bigint CHECK (file_size_bytes IS NULL OR file_size_bytes > 0),
  caption text,
  uploaded_by uuid NOT NULL REFERENCES ebiomed.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_work_order_attachments_work_order
  ON ebiomed.work_order_attachments(work_order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_work_order_attachments_media_type
  ON ebiomed.work_order_attachments(media_type);

ALTER TABLE ebiomed.work_order_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Work order attachments viewable by authenticated" ON ebiomed.work_order_attachments;
CREATE POLICY "Work order attachments viewable by authenticated" ON ebiomed.work_order_attachments
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Work order attachments insertable by admin or technician" ON ebiomed.work_order_attachments;
CREATE POLICY "Work order attachments insertable by admin or technician" ON ebiomed.work_order_attachments
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND
    uploaded_by = auth.uid() AND
    EXISTS (
      SELECT 1
      FROM ebiomed.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'technician')
    )
  );
GRANT SELECT, INSERT ON ebiomed.work_order_attachments TO authenticated;

INSERT INTO storage.buckets (id, name, public)
VALUES ('work-order-media', 'work-order-media', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Work order media readable by authenticated" ON storage.objects;
CREATE POLICY "Work order media readable by authenticated" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'work-order-media' AND auth.role() = 'authenticated'
  );

DROP POLICY IF EXISTS "Work order media uploadable by admin or technician" ON storage.objects;
CREATE POLICY "Work order media uploadable by admin or technician" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'work-order-media' AND
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1
      FROM ebiomed.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'technician')
    )
  );
