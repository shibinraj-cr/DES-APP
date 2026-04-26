-- Extend broadcasts table for v2 features
ALTER TABLE broadcasts
  ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT '24h',
  ADD COLUMN IF NOT EXISTS template_name TEXT,
  ADD COLUMN IF NOT EXISTS include_label_ids UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS exclude_label_ids UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS assign_label_id UUID REFERENCES contact_tags(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS opened_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivered_count INT DEFAULT 0;

-- Allow 'scheduled' as a status value (column is already TEXT, just documenting)
-- Possible values: draft | scheduled | sending | sent | failed
