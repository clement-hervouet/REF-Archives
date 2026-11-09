-- Bloc 10 : gestion des comptes par l'administrateur (page « Comptes »).
--  * Blocage : `blocked_at` (début) et `blocked_until` (fin, exclue). NULL en fin = jusqu'à
--    déblocage par un admin. Le compte est actif si `blocked_at` est NULL ou si
--    `blocked_until` est passé ; la condition vit dans src/server/db/account-state.ts.
--  * Suppression différée : `deletion_due_at` = date à partir de laquelle la purge planifiée
--    efface le compte et toutes ses données (CASCADE depuis "user"). D'ici là, le compte est
--    coupé comme s'il était bloqué, et un admin peut annuler.
--  * Journal : `target_user_id` = compte visé par une action d'admin (`user_id` reste
--    l'auteur). SET NULL : la ligne survit, anonymisée, à la suppression du compte.
--  * ALTER TYPE … ADD VALUE dans une transaction : accepté (PostgreSQL ≥ 12) tant que la
--    valeur n'y est pas utilisée ; IF NOT EXISTS rend la migration rejouable.

-- Up Migration

ALTER TYPE security_event_type ADD VALUE IF NOT EXISTS 'account_updated';
ALTER TYPE security_event_type ADD VALUE IF NOT EXISTS 'account_blocked';
ALTER TYPE security_event_type ADD VALUE IF NOT EXISTS 'account_unblocked';
ALTER TYPE security_event_type ADD VALUE IF NOT EXISTS 'account_password_reset_sent';
ALTER TYPE security_event_type ADD VALUE IF NOT EXISTS 'account_deletion_scheduled';
ALTER TYPE security_event_type ADD VALUE IF NOT EXISTS 'account_deletion_cancelled';
ALTER TYPE security_event_type ADD VALUE IF NOT EXISTS 'account_deleted';

ALTER TABLE "user"
  ADD COLUMN blocked_at timestamptz,
  ADD COLUMN blocked_until timestamptz,
  ADD COLUMN deletion_due_at timestamptz;

ALTER TABLE "user"
  -- Une fin de blocage n'existe pas sans début, et vient après lui.
  ADD CONSTRAINT user_blocked_until_check CHECK (
    blocked_until IS NULL OR (blocked_at IS NOT NULL AND blocked_until > blocked_at)
  );

-- La purge cherche les comptes dont la suppression est due.
CREATE INDEX user_deletion_due_at_idx ON "user" (deletion_due_at)
  WHERE deletion_due_at IS NOT NULL;

ALTER TABLE security_event
  ADD COLUMN target_user_id uuid REFERENCES "user" (id) ON DELETE SET NULL;

CREATE INDEX security_event_target_user_id_idx ON security_event (target_user_id);

-- Down Migration

DROP INDEX security_event_target_user_id_idx;
ALTER TABLE security_event DROP COLUMN target_user_id;
DROP INDEX user_deletion_due_at_idx;
ALTER TABLE "user" DROP CONSTRAINT user_blocked_until_check;
ALTER TABLE "user"
  DROP COLUMN deletion_due_at,
  DROP COLUMN blocked_until,
  DROP COLUMN blocked_at;
-- Les valeurs ajoutées à security_event_type restent (voir 012_flux-ical.sql).
