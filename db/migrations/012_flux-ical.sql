-- Bloc 8 : flux iCal (§5.4).
-- L'utilisateur s'abonne depuis son agenda (Google, Samsung, Apple…) à une URL qui contient
-- un jeton secret. Comme pour les invitations, seule l'empreinte SHA-256 du jeton est
-- stockée : la base ne permet pas de reconstruire l'URL.
--  * Un seul flux par compte (clé primaire user_id) : régénérer remplace l'empreinte, ce qui
--    rend l'ancienne URL inutilisable immédiatement ; révoquer supprime la ligne.
--  * Journal de sécurité : création (ou régénération) et révocation du lien. On ajoute au
--    passage les deux valeurs du reset de mot de passe (bloc 4) : le code les utilise mais
--    elles manquaient à l'énumération, si bien que ces événements n'étaient jamais écrits.
--  * ALTER TYPE … ADD VALUE est accepté dans une transaction (PostgreSQL ≥ 12) tant que la
--    nouvelle valeur n'y est pas utilisée. IF NOT EXISTS rend la migration rejouable.

-- Up Migration

ALTER TYPE security_event_type ADD VALUE IF NOT EXISTS 'password_reset_requested';
ALTER TYPE security_event_type ADD VALUE IF NOT EXISTS 'password_reset_completed';
ALTER TYPE security_event_type ADD VALUE IF NOT EXISTS 'calendar_feed_created';
ALTER TYPE security_event_type ADD VALUE IF NOT EXISTS 'calendar_feed_revoked';

CREATE TABLE calendar_feed (
  user_id uuid PRIMARY KEY REFERENCES "user" (id) ON DELETE CASCADE,
  -- SHA-256 du jeton : le jeton lui-même n'existe que dans l'URL montrée une fois.
  token_hash bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT calendar_feed_token_hash_key UNIQUE (token_hash),
  CONSTRAINT calendar_feed_token_hash_length_check CHECK (octet_length(token_hash) = 32)
);

-- Down Migration

-- Les valeurs ajoutées à security_event_type restent : PostgreSQL ne sait pas retirer une
-- valeur d'une énumération, et des lignes du journal peuvent déjà les utiliser.
DROP TABLE calendar_feed;
