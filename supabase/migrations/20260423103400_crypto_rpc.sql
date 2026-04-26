CREATE OR REPLACE FUNCTION save_whatsapp_credentials(
  p_workspace_id UUID,
  p_phone_number_id TEXT,
  p_waba_id TEXT,
  p_access_token TEXT,
  p_encryption_key TEXT
) RETURNS void AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM workspace_members 
    WHERE workspace_id = p_workspace_id 
    AND user_id = auth.uid() 
    AND role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Not authorized to modify WhatsApp credentials for this workspace';
  END IF;

  INSERT INTO whatsapp_accounts (workspace_id, phone_number_id, waba_id, access_token)
  VALUES (
    p_workspace_id, 
    p_phone_number_id, 
    p_waba_id, 
    pgp_sym_encrypt(p_access_token, p_encryption_key)
  )
  ON CONFLICT (workspace_id) 
  DO UPDATE SET 
    phone_number_id = EXCLUDED.phone_number_id,
    waba_id = EXCLUDED.waba_id,
    access_token = EXCLUDED.access_token,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
