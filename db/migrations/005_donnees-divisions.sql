-- Up Migration

-- Référentiel des divisions (indicatif, à ajuster au bloc 5 par de nouvelles migrations).
-- Idempotent grâce à la contrainte d'unicité (division, type, level).
INSERT INTO division (division, type, level)
SELECT d.division::division_division, t.type::division_type, l.level::division_level
FROM (VALUES ('Departemental'), ('Regional')) AS d (division)
CROSS JOIN (VALUES ('Masculin'), ('Feminin')) AS t (type)
CROSS JOIN (VALUES ('U13'), ('U15'), ('U18'), ('1'), ('2'), ('3')) AS l (level)
ON CONFLICT DO NOTHING;

INSERT INTO division (division, type, level)
SELECT 'National'::division_division, t.type::division_type, l.level::division_level
FROM (VALUES ('Masculin'), ('Feminin')) AS t (type)
CROSS JOIN (VALUES ('U15'), ('U18'), ('U21'), ('1'), ('2'), ('3')) AS l (level)
ON CONFLICT DO NOTHING;

INSERT INTO division (division, type, level)
SELECT 'Pro'::division_division, t.type::division_type, l.level::division_level
FROM (VALUES ('Masculin'), ('Feminin')) AS t (type)
CROSS JOIN (VALUES ('1'), ('2')) AS l (level)
ON CONFLICT DO NOTHING;

-- Down Migration

-- Échoue volontairement si une division est encore utilisée (NO ACTION).
DELETE FROM division;