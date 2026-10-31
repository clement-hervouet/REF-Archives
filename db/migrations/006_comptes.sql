-- Bloc 3 : comptes. Rôle utilisateur, invitations, sessions (liste de révocation
-- des JWT Auth.js) et compteurs de rate limiting.

-- Up Migration

CREATE TYPE user_role AS ENUM ('admin', 'user');

-- Les comptes existants (seed de dev) deviennent des utilisateurs simples.
ALTER TABLE "user" ADD COLUMN role user_role NOT NULL DEFAULT 'user';

-- Invitation à usage unique : seul le hash SHA-256 du jeton est stocké.
-- invited_by est nullable : supprimer le compte de l'invitant ne doit pas
-- être bloqué ni effacer l'historique.
CREATE TABLE invitation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email varchar(255) NOT NULL,
  token_hash bytea NOT NULL,
  invited_by uuid REFERENCES "user" (id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invitation_token_hash_key UNIQUE (token_hash),
  CONSTRAINT invitation_token_hash_length_check CHECK (octet_length(token_hash) = 32),
  CONSTRAINT invitation_expires_after_created_check CHECK (expires_at > created_at),
  -- Une invitation est soit acceptée, soit révoquée, jamais les deux.
  CONSTRAINT invitation_single_outcome_check CHECK (accepted_at IS NULL OR revoked_at IS NULL)
);
CREATE INDEX invitation_email_lower_idx ON invitation (lower(email));

-- Session : le JWT ne porte que l'id de cette ligne, vérifié en base à chaque
-- requête. Révoquer (revoked_at) ou supprimer la ligne invalide la session.
CREATE TABLE session (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  CONSTRAINT session_expires_after_created_check CHECK (expires_at > created_at)
);
CREATE INDEX session_user_id_idx ON session (user_id);
-- Sert à la purge des sessions expirées.
CREATE INDEX session_expires_at_idx ON session (expires_at);

-- Compteurs de rate limiting. La clé est un identifiant déjà haché par
-- l'application (jamais d'IP ni d'email en clair). `strikes` compte les
-- blocages successifs et permet un délai croissant.
CREATE TABLE rate_limit (
  key text PRIMARY KEY,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  strikes integer NOT NULL DEFAULT 0 CHECK (strikes >= 0),
  window_started_at timestamptz NOT NULL DEFAULT now(),
  blocked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rate_limit_key_length_check CHECK (char_length(key) <= 200)
);
-- Sert à la purge des compteurs inactifs.
CREATE INDEX rate_limit_updated_at_idx ON rate_limit (updated_at);

-- Down Migration

DROP TABLE rate_limit;
DROP TABLE session;
DROP TABLE invitation;
ALTER TABLE "user" DROP COLUMN role;
DROP TYPE user_role;