-- Catégories d'axes d'amélioration créées par l'arbitre, à côté des axes par défaut : une
-- ligne de `improvement_axis` sans `default_key`, avec un nom (`label`) choisi par
-- l'utilisateur. Elle se range, se renomme et se supprime ; les axes par défaut se rangent
-- seulement.
--  * Une ligne est soit un axe par défaut (`default_key`), soit une catégorie (`label`).
--  * Nom : sans espace au début ni à la fin, 60 caractères au plus, unique par utilisateur
--    sans tenir compte de la casse (l'application refuse aussi le nom d'un axe par défaut).
-- Bornes alignées sur `src/lib/improvement-axes-fields.ts`.
-- Effet sur les données existantes : aucun (lignes existantes : axes par défaut).

-- Up Migration

ALTER TABLE improvement_axis
  ALTER COLUMN default_key DROP NOT NULL,
  ADD COLUMN label text,
  ADD CONSTRAINT improvement_axis_kind_check CHECK ((default_key IS NULL) <> (label IS NULL)),
  ADD CONSTRAINT improvement_axis_label_check CHECK (label IS NULL
    OR (label ~ '\S' AND label = btrim(label) AND char_length(label) <= 60));

CREATE UNIQUE INDEX improvement_axis_user_label_key ON improvement_axis (user_id, lower(label))
  WHERE label IS NOT NULL;

-- Down Migration

-- Les catégories personnelles et leurs textes sont perdus.
DELETE FROM improvement_axis WHERE default_key IS NULL;

DROP INDEX improvement_axis_user_label_key;

ALTER TABLE improvement_axis
  DROP CONSTRAINT improvement_axis_label_check,
  DROP CONSTRAINT improvement_axis_kind_check,
  DROP COLUMN label,
  ALTER COLUMN default_key SET NOT NULL;
