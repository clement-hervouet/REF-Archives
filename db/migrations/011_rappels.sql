-- Bloc 7 : rappels par email.
-- L'application ne stocke pas les indisponibilités (elles se saisissent ailleurs) : elle
-- rappelle chaque semaine de les renseigner pour le weekend dans N semaines, et envoie
-- avant chaque weekend le récapitulatif des matchs prévus (indemnités à venir).
--  * Réglages par utilisateur sur "user" : un seul jeu de valeurs par compte, lu par le
--    job planifié en une requête. Emails non essentiels, donc désactivables (§9).
--  * reminder_dispatch : un envoi par utilisateur, par type et par période. La clé
--    primaire rend le job idempotent (§9) : la ligne est réservée AVANT l'envoi.

-- Up Migration

ALTER TABLE "user"
  ADD COLUMN availability_reminder_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN availability_reminder_weeks smallint NOT NULL DEFAULT 5,
  ADD COLUMN weekend_recap_enabled boolean NOT NULL DEFAULT true,
  ADD CONSTRAINT user_availability_reminder_weeks_check
    CHECK (availability_reminder_weeks BETWEEN 1 AND 12);

CREATE TYPE reminder_kind AS ENUM ('availability', 'weekend_recap');

CREATE TABLE reminder_dispatch (
  user_id uuid NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  kind reminder_kind NOT NULL,
  -- Période couverte, en jour calendaire de Paris : lundi de la semaine d'envoi pour le
  -- rappel des indisponibilités, samedi du weekend pour le récapitulatif.
  period_start date NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, kind, period_start)
);

-- Sert à la purge des envois anciens par le job planifié.
CREATE INDEX reminder_dispatch_sent_at_idx ON reminder_dispatch (sent_at);

-- Down Migration

DROP TABLE reminder_dispatch;
DROP TYPE reminder_kind;
ALTER TABLE "user"
  DROP CONSTRAINT user_availability_reminder_weeks_check,
  DROP COLUMN weekend_recap_enabled,
  DROP COLUMN availability_reminder_weeks,
  DROP COLUMN availability_reminder_enabled;
