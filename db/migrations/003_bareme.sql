-- Up Migration

-- Barème : une ligne = un montant de match pour une division à partir d'une date.
-- Les lignes ne sont jamais modifiées : on ajoute une ligne avec une nouvelle date d'application.
-- Le barème d'un match est la ligne la plus récente avec effective_from <= date du match (Europe/Paris).
CREATE TABLE scale (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  division_id uuid NOT NULL REFERENCES division (id) ON DELETE NO ACTION,
  effective_from date NOT NULL,
  game_amount_cents integer NOT NULL CHECK (game_amount_cents >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT scale_id_user_id_key UNIQUE (id, user_id),
  CONSTRAINT scale_user_division_effective_from_key UNIQUE (user_id, division_id, effective_from)
);

-- Taux kilométrique daté, en centimes par km (40.00 = 0,40 €/km). numeric : valeur exacte, jamais de float.
CREATE TABLE mileage_rate (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  effective_from date NOT NULL,
  cents_per_km numeric(6, 2) NOT NULL CHECK (cents_per_km >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mileage_rate_id_user_id_key UNIQUE (id, user_id),
  CONSTRAINT mileage_rate_user_effective_from_key UNIQUE (user_id, effective_from)
);

-- Down Migration

DROP TABLE mileage_rate;
DROP TABLE scale;