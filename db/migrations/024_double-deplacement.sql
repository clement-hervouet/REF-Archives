-- Doublé (§15.4.5) : deux matchs arbitrés le même jour au même endroit. Le déplacement
-- n'est indemnisé qu'une fois : sur le second match, l'indemnité kilométrique vaut 0.
-- La distance reste enregistrée (elle sert de nouveau si la case est décochée).
-- Effet sur les données existantes : aucun, toutes les indemnités gardent leur
-- kilométrage (valeur par défaut false).

-- Up Migration

ALTER TABLE compensation ADD COLUMN travel_shared boolean NOT NULL DEFAULT false;

-- Down Migration

ALTER TABLE compensation DROP COLUMN travel_shared;
