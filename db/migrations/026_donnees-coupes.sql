-- Coupes (§15.4.6) : les 24 niveaux de coupe. Départementale, régionale et Coupe de France
-- (portée National), en U13, U15, U18 et Seniors, masculin et féminin.
-- Séparée de 025 : la valeur `Seniors` ajoutée à `division_level` ne peut servir qu'après
-- la validation de la transaction qui l'a créée.
-- Idempotent grâce à la contrainte d'unicité (division, type, level, cup).
-- Effet sur les données existantes : aucun (ajout de lignes au référentiel).

-- Up Migration

INSERT INTO division (division, type, level, cup)
SELECT d.division::division_division, t.type::division_type, l.level::division_level, true
FROM (VALUES ('Departemental'), ('Regional'), ('National')) AS d (division)
CROSS JOIN (VALUES ('Masculin'), ('Feminin')) AS t (type)
CROSS JOIN (VALUES ('U13'), ('U15'), ('U18'), ('Seniors')) AS l (level)
ON CONFLICT DO NOTHING;

-- Down Migration

-- Échoue volontairement si un niveau de coupe est encore utilisé (NO ACTION).
DELETE FROM division WHERE cup;
