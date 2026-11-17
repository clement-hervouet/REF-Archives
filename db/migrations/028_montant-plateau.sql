-- Plateaux (§15.4.7) : le montant par match se saisit sur chaque indemnité de plateau ; le
-- barème ne sert plus qu'au taux kilométrique pour un plateau.
--  * `compensation.plateau_game_cents` : montant par match en centimes (0 à 99 999,99 €),
--    renseigné si et seulement si `game_count` l'est (plateau).
--  * Les plateaux déjà saisis (027, en développement seulement) reprennent le montant par
--    match de leur ligne de barème : leur montant ne change pas.
-- Effet sur les données existantes : aucun hors plateau (colonne NULL, montant inchangé).

-- Up Migration

ALTER TABLE compensation ADD COLUMN plateau_game_cents integer;

UPDATE compensation c
SET plateau_game_cents = r.game_amount_cents
FROM scale_rate r
WHERE r.id = c.scale_rate_id AND c.game_count IS NOT NULL;

ALTER TABLE compensation
  ADD CONSTRAINT compensation_plateau_game_cents_check
    CHECK (plateau_game_cents BETWEEN 0 AND 9999999),
  ADD CONSTRAINT compensation_plateau_fields_check
    CHECK ((game_count IS NULL) = (plateau_game_cents IS NULL));

-- Down Migration

ALTER TABLE compensation DROP CONSTRAINT compensation_plateau_fields_check;
ALTER TABLE compensation DROP CONSTRAINT compensation_plateau_game_cents_check;
ALTER TABLE compensation DROP COLUMN plateau_game_cents;
