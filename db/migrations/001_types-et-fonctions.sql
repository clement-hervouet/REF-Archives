-- Up Migration

-- Types énumérés. Valeurs corrigées : 'correspondent' et 'observer'.
CREATE TYPE person_type AS ENUM ('correspondent', 'referee', 'observer');

CREATE TYPE division_division AS ENUM ('Departemental', 'Regional', 'National', 'Pro');

CREATE TYPE division_level AS ENUM ('U13', 'U15', 'U18', 'U21', '1', '2', '3');

CREATE TYPE division_type AS ENUM ('Masculin', 'Feminin');

-- Maintient updated_at à jour côté base : aucune requête applicative ne peut l'oublier.
CREATE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Down Migration

DROP FUNCTION set_updated_at();
DROP TYPE division_type;
DROP TYPE division_level;
DROP TYPE division_division;
DROP TYPE person_type;