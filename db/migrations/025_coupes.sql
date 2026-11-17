-- Coupes (§15.4.6) : niveaux de coupe (départementale, régionale, Coupe de France) et tour
-- du match (1/64 à finale).
--  * Un niveau de coupe est une ligne de `division` avec `cup = true` : la portée
--    (Departemental, Regional, National) garde la déduction de l'organisme qui verse, et un
--    barème par défaut peut lui être associé comme à tout niveau. Les catégories des coupes
--    sont U13, U15, U18 et Seniors : on ajoute la valeur `Seniors` à `division_level`.
--  * Le tour n'est pas un niveau : il est porté par l'indemnité et le match complet
--    (`cup_round`), NULL hors coupe. Cohérence niveau de coupe ⇔ tour renseigné : vérifiée
--    par l'application (§6.3).
--  * ALTER TYPE … ADD VALUE est accepté dans une transaction (PostgreSQL ≥ 12), mais la
--    nouvelle valeur ne peut pas y être utilisée : les niveaux sont insérés par la migration
--    suivante (026_donnees-coupes.sql), dans sa propre transaction.
-- Effet sur les données existantes : aucun (toutes les divisions restent des championnats,
-- aucune indemnité ni aucun match n'a de tour).

-- Up Migration

ALTER TYPE division_level ADD VALUE IF NOT EXISTS 'Seniors';

ALTER TABLE division ADD COLUMN cup boolean NOT NULL DEFAULT false;

ALTER TABLE division DROP CONSTRAINT division_division_type_level_key;
ALTER TABLE division
  ADD CONSTRAINT division_division_type_level_cup_key UNIQUE (division, type, level, cup);

-- Tours, du plus lointain à la finale (ordre de déclaration = ordre de tri).
CREATE TYPE cup_round AS ENUM ('R64', 'R32', 'R16', 'R8', 'R4', 'R2', 'F');

ALTER TABLE compensation ADD COLUMN cup_round cup_round;
ALTER TABLE game ADD COLUMN cup_round cup_round;

-- Down Migration

-- Échoue volontairement si un niveau de coupe existe encore (descendre d'abord 026).
ALTER TABLE game DROP COLUMN cup_round;
ALTER TABLE compensation DROP COLUMN cup_round;
DROP TYPE cup_round;
ALTER TABLE division DROP CONSTRAINT division_division_type_level_cup_key;
ALTER TABLE division
  ADD CONSTRAINT division_division_type_level_key UNIQUE (division, type, level);
ALTER TABLE division DROP COLUMN cup;
-- La valeur `Seniors` reste dans `division_level` (PostgreSQL ne retire pas une valeur
-- d'énumération) : sans effet, aucune ligne ne l'utilise plus.
