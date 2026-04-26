-- Add post-send automation actions to webhook workflows
ALTER TABLE webhook_workflows
  ADD COLUMN IF NOT EXISTS post_send_actions JSONB DEFAULT '{}';

-- Structure: { "tag_id": "uuid", "sequence_id": "uuid" }
-- tag_id    → assign this label to the contact after every successful send
-- sequence_id → enroll the contact in this bot sequence after every successful send
