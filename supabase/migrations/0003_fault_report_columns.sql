ALTER TABLE ebiomed.work_orders ADD COLUMN IF NOT EXISTS reported_by_name text;
ALTER TABLE ebiomed.work_orders ADD COLUMN IF NOT EXISTS reported_by_department text;
ALTER TABLE ebiomed.work_orders ADD COLUMN IF NOT EXISTS issue_photo_url text;
