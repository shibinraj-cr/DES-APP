CREATE TABLE IF NOT EXISTS bot_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  trigger_type TEXT NOT NULL DEFAULT 'keyword',
  trigger_value TEXT,
  response_message TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE bot_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace members can manage bot rules"
  ON bot_rules FOR ALL
  USING (workspace_id = ANY(get_user_workspace_ids()))
  WITH CHECK (workspace_id = ANY(get_user_workspace_ids()));
