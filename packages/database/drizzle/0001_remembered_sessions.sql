-- Renewal credentials share the session's revocation and device ownership.
ALTER TABLE auth_sessions
  ADD COLUMN renewal_hash text,
  ADD COLUMN renewal_installation_id text,
  ADD COLUMN renewal_used_at timestamptz,
  ADD COLUMN renewal_expires_at timestamptz;
CREATE UNIQUE INDEX auth_sessions_renewal_hash_uq ON auth_sessions (renewal_hash) WHERE renewal_hash IS NOT NULL;
ALTER TABLE auth_sessions ADD CONSTRAINT auth_sessions_renewal_check CHECK (
  (renewal_hash IS NULL AND renewal_installation_id IS NULL AND renewal_used_at IS NULL AND renewal_expires_at IS NULL)
  OR (renewal_hash IS NOT NULL AND renewal_hash ~ '^[0-9a-f]{64}$' AND renewal_installation_id IS NOT NULL AND renewal_used_at IS NOT NULL AND renewal_expires_at IS NOT NULL)
);
