CREATE OR REPLACE FUNCTION get_whatsapp_credentials(p_workspace_id UUID, p_encryption_key TEXT)
RETURNS TABLE(phone_number_id TEXT, waba_id TEXT, access_token TEXT)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = p_workspace_id
    AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized to read WhatsApp credentials for this workspace';
  END IF;

  RETURN QUERY
  SELECT
    wa.phone_number_id,
    wa.waba_id,
    pgp_sym_decrypt_text(wa.access_token::bytea, p_encryption_key) AS access_token
  FROM whatsapp_accounts wa
  WHERE wa.workspace_id = p_workspace_id;
END;
$$;
