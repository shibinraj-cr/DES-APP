ALTER TABLE templates
  ADD COLUMN IF NOT EXISTS meta_template_id TEXT,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS header_type TEXT DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS footer TEXT,
  ADD COLUMN IF NOT EXISTS buttons JSONB DEFAULT '[]';

-- Update status column to allow draft as a valid status
-- (existing status type: approved|pending|rejected — add draft)
ALTER TABLE templates ALTER COLUMN status TYPE TEXT;
ALTER TABLE templates ALTER COLUMN status SET DEFAULT 'draft';
