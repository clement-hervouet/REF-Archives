-- Bloc 3, étape 6 : journal des événements de sécurité (§6.1, A09).
-- Aucune donnée sensible : ni email, ni mot de passe, ni jeton, ni IP en clair
-- (empreinte HMAC calculée par l'application).

-- Up Migration

CREATE TYPE security_event_type AS ENUM (
  'login_succeeded',
  'login_failed',
  'logout',
  'invitation_created',
  'invitation_revoked',
  'invitation_accepted',
  'invitation_rejected'
);

CREATE TABLE security_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type security_event_type NOT NULL,
  -- Nullable : inconnu pour un échec de connexion, et conservé anonymisé si le compte est supprimé.
  user_id uuid REFERENCES "user" (id) ON DELETE SET NULL,
  -- HMAC-SHA256 en hexadécimal (64 caractères) ; NULL si l'IP est inconnue.
  ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT security_event_ip_hash_length_check CHECK (ip_hash IS NULL OR char_length(ip_hash) = 64)
);
-- Sert à la purge par ancienneté et au tri chronologique.
CREATE INDEX security_event_created_at_idx ON security_event (created_at);
CREATE INDEX security_event_user_id_idx ON security_event (user_id, created_at);

-- Down Migration

DROP TABLE security_event;
DROP TYPE security_event_type;