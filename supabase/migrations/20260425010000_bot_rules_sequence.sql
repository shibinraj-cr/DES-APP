-- Extend bot_rules to support sequence activation
ALTER TABLE bot_rules
  ADD COLUMN IF NOT EXISTS action_type TEXT NOT NULL DEFAULT 'reply',
  ADD COLUMN IF NOT EXISTS sequence_id UUID REFERENCES bot_sequences(id) ON DELETE CASCADE;

-- action_type values: 'reply' (send message), 'sequence' (start a sequence)
-- response_message is nullable so sequence rules don't need one
ALTER TABLE bot_rules ALTER COLUMN response_message DROP NOT NULL;
