CREATE TABLE ebiomed.wo_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL REFERENCES ebiomed.work_orders(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES ebiomed.profiles(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_wo_comments_work_order_id ON ebiomed.wo_comments(work_order_id, created_at);
