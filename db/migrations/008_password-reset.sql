-- Up Migration

CREATE TABLE password_reset (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL,
  -- SHA-256 du jeton : le jeton lui-même n'existe que dans le lien envoyé par email.
  token_hash  bytea NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz,
  CONSTRAINT password_reset_user_fk
    FOREIGN KEY (user_id) REFERENCES "user" (id) ON DELETE CASCADE,
  CONSTRAINT password_reset_token_hash_key UNIQUE (token_hash),
  CONSTRAINT password_reset_token_hash_length CHECK (octet_length(token_hash) = 32),
  CONSTRAINT password_reset_expiry_check CHECK (expires_at > created_at)
);

CREATE INDEX password_reset_user_id_idx ON password_reset (user_id);

-- Down Migration

DROP TABLE password_reset;