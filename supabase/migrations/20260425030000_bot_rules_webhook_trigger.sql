ALTER TABLE bot_rules
  ADD COLUMN IF NOT EXISTS delay_minutes INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS webhook_workflow_id UUID REFERENCES webhook_workflows(id) ON DELETE SET NULL;

ALTER TABLE sequence_contacts
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;
