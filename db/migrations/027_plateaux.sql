-- Plateaux (§15.4.7) : un arbitre officie plusieurs matchs d'un même plateau de jeunes, chez
-- un club organisateur. Indemnité = kilométrage + nombre de matchs × montant par match.
--  * Un niveau de plateau est une ligne de `division` avec `plateau = true` (jamais aussi
--    coupe) : départemental et régional, U13, U15, U18, masculin et féminin (12 niveaux).
--  * Un plateau n'a qu'un club, l'organisateur (équipe 1) : `team2_id` devient facultatif
--    sur l'indemnité et le match complet. L'application l'exige hors plateau. La contrainte
--    « équipes différentes » laisse passer NULL ; la FK composite (MATCH SIMPLE) aussi.
--  * `compensation.game_count` : nombre de matchs du plateau (1 à 10), NULL hors plateau
--    (= 1 match pour le calcul). Cohérence niveau ⇔ nombre : vérifiée par l'application.
-- Effet sur les données existantes : aucun (toutes les indemnités et tous les matchs
-- gardent leurs deux équipes ; aucun nombre de matchs, montant inchangé).

-- Up Migration

ALTER TABLE division ADD COLUMN plateau boolean NOT NULL DEFAULT false;

ALTER TABLE division
  ADD CONSTRAINT division_cup_or_plateau_check CHECK (NOT (cup AND plateau));

ALTER TABLE division DROP CONSTRAINT division_division_type_level_cup_key;
ALTER TABLE division
  ADD CONSTRAINT division_division_type_level_cup_plateau_key
    UNIQUE (division, type, level, cup, plateau);

INSERT INTO division (division, type, level, plateau)
SELECT d.division::division_division, t.type::division_type, l.level::division_level, true
FROM (VALUES ('Departemental'), ('Regional')) AS d (division)
CROSS JOIN (VALUES ('Masculin'), ('Feminin')) AS t (type)
CROSS JOIN (VALUES ('U13'), ('U15'), ('U18')) AS l (level)
ON CONFLICT DO NOTHING;

ALTER TABLE compensation ALTER COLUMN team2_id DROP NOT NULL;
ALTER TABLE game ALTER COLUMN team2_id DROP NOT NULL;

ALTER TABLE compensation ADD COLUMN game_count smallint;
ALTER TABLE compensation
  ADD CONSTRAINT compensation_game_count_check CHECK (game_count BETWEEN 1 AND 10);

-- Down Migration

-- Échoue volontairement si un plateau est encore enregistré (équipe 2 absente, niveau
-- de plateau utilisé) : restaurer une sauvegarde plutôt que de descendre en production.
ALTER TABLE compensation DROP CONSTRAINT compensation_game_count_check;
ALTER TABLE compensation DROP COLUMN game_count;
ALTER TABLE game ALTER COLUMN team2_id SET NOT NULL;
ALTER TABLE compensation ALTER COLUMN team2_id SET NOT NULL;
DELETE FROM division WHERE plateau;
ALTER TABLE division DROP CONSTRAINT division_division_type_level_cup_plateau_key;
ALTER TABLE division
  ADD CONSTRAINT division_division_type_level_cup_key UNIQUE (division, type, level, cup);
ALTER TABLE division DROP CONSTRAINT division_cup_or_plateau_check;
ALTER TABLE division DROP COLUMN plateau;
