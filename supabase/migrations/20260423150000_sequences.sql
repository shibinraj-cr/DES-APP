CREATE TABLE IF NOT EXISTS bot_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL DEFAULT 'keyword',
  trigger_value TEXT,
  is_active BOOLEAN NOT NULL DEFAULT false,
  pause_on_reply BOOLEAN NOT NULL DEFAULT true,
  send_window_start TIME,
  send_window_end TIME,
  flow_data JSONB DEFAULT '{"nodes":[],"edges":[]}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE bot_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace members can manage sequences"
  ON bot_sequences FOR ALL
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ))
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

CREATE TABLE IF NOT EXISTS sequence_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID NOT NULL REFERENCES bot_sequences(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  current_node_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE(sequence_id, contact_id)
);

ALTER TABLE sequence_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace members can view sequence contacts"
  ON sequence_contacts FOR ALL
  USING (
    sequence_id IN (
      SELECT id FROM bot_sequences WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    sequence_id IN (
      SELECT id FROM bot_sequences WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );
