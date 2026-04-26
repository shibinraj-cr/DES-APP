-- Add opt-out tracking to contacts
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS opted_out BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS opted_out_at TIMESTAMPTZ;

-- Add color to tags for visual labels
ALTER TABLE contact_tags
  ADD COLUMN IF NOT EXISTS color TEXT NOT NULL DEFAULT 'slate';

-- Index for fast opted_out queries
CREATE INDEX IF NOT EXISTS contacts_opted_out_idx ON contacts(workspace_id, opted_out);
