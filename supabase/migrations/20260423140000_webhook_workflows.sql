CREATE TABLE IF NOT EXISTS webhook_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  template_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  secret_token TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  total_targeted BIGINT DEFAULT 0,
  total_sent BIGINT DEFAULT 0,
  total_delivered BIGINT DEFAULT 0,
  total_failed BIGINT DEFAULT 0,
  last_called_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE webhook_workflows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace members can manage webhook workflows"
  ON webhook_workflows FOR ALL
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ))
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));
