ALTER TABLE webhook_workflows
  ADD COLUMN IF NOT EXISTS field_mapping   JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS delay_minutes   INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS conditions      JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS condition_mode  TEXT DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS last_payload    JSONB;

CREATE TABLE IF NOT EXISTS webhook_send_queue (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id    UUID NOT NULL REFERENCES webhook_workflows(id) ON DELETE CASCADE,
  workspace_id   UUID NOT NULL,
  phone          TEXT NOT NULL,
  contact_name   TEXT,
  template_params JSONB DEFAULT '{}',
  scheduled_at   TIMESTAMPTZ NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
