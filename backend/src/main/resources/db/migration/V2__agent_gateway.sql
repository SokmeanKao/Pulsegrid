-- Agent-initiated gateway: agents dial Monitor; no required outbound grpc address.
ALTER TABLE servers
  ALTER COLUMN grpc_host DROP NOT NULL,
  ALTER COLUMN grpc_port DROP NOT NULL;

ALTER TABLE servers
  ADD COLUMN IF NOT EXISTS last_remote_addr TEXT;

CREATE TABLE IF NOT EXISTS enrollment_tokens (
  id          UUID PRIMARY KEY,
  server_id   TEXT NOT NULL,
  token_hash  TEXT NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by  TEXT NOT NULL DEFAULT 'ui'
);

CREATE INDEX IF NOT EXISTS idx_enrollment_tokens_server
  ON enrollment_tokens (server_id);
