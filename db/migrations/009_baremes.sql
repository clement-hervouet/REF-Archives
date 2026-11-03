-- Bloc 5 : barèmes d'indemnités.
-- Un barème = un nom + des lignes datées, chacune portant un montant de match ET un taux km.
-- Le barème commun (user_id NULL) est unique, visible par tous, modifiable par l'admin seulement.
-- Chaque utilisateur crée ses barèmes et peut choisir un barème par défaut pour un niveau
-- (division) ; sans choix, c'est le barème commun.
-- Remplace scale (une ligne par division) et mileage_rate de 003_bareme.sql.

-- Up Migration

-- Garde-fou : aucune donnée réelle n'existe encore. Si des indemnités sont présentes
-- (seed de dev), on refuse plutôt que de les perdre en silence : lancer `pnpm db:reset`.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM compensation) THEN
    RAISE EXCEPTION '009_baremes : des indemnités existent déjà ; lancer pnpm db:reset en développement';
  END IF;
END
$$;

ALTER TABLE compensation DROP CONSTRAINT compensation_scale_fk;
ALTER TABLE compensation DROP CONSTRAINT compensation_mileage_rate_fk;
DROP INDEX compensation_scale_id_idx;
DROP INDEX compensation_mileage_rate_id_idx;
ALTER TABLE compensation DROP COLUMN scale_id;
ALTER TABLE compensation DROP COLUMN mileage_rate_id;

DROP TABLE mileage_rate;
DROP TABLE scale;

-- Barème. user_id NULL = barème commun : c'est la seule ressource sans propriétaire,
-- donc toute requête doit l'autoriser explicitement en lecture (« à moi OU commun ») et
-- réserver l'écriture à l'admin (§6.2).
CREATE TABLE scale (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES "user" (id) ON DELETE CASCADE,
  name varchar(100) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Soft delete : un barème déjà utilisé par une indemnité reste en base pour l'historique,
  -- mais n'est plus proposé.
  deleted_at timestamptz,
  -- Sert aux FK composites (scale_id, user_id) qui imposent un barème personnel à soi.
  CONSTRAINT scale_id_user_id_key UNIQUE (id, user_id),
  CONSTRAINT scale_name_not_blank_check CHECK (char_length(btrim(name)) > 0),
  -- Le barème commun ne peut pas être supprimé.
  CONSTRAINT scale_common_not_deleted_check CHECK (user_id IS NOT NULL OR deleted_at IS NULL)
);

-- Un seul barème commun.
CREATE UNIQUE INDEX scale_one_common_key ON scale ((user_id IS NULL)) WHERE user_id IS NULL;
-- Pas deux barèmes actifs du même nom pour un utilisateur (insensible à la casse).
CREATE UNIQUE INDEX scale_user_name_active_key ON scale (user_id, lower(name))
  WHERE user_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX scale_user_id_idx ON scale (user_id) WHERE deleted_at IS NULL;

CREATE TRIGGER scale_set_updated_at BEFORE UPDATE ON scale
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Ligne de barème immuable : en vigueur à partir de effective_from (date Europe/Paris),
-- jusqu'à la ligne suivante. Pas de user_id : la propriété passe par scale, car le barème
-- commun n'a pas de propriétaire (une FK composite est impossible vers lui).
CREATE TABLE scale_rate (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scale_id uuid NOT NULL REFERENCES scale (id) ON DELETE CASCADE,
  effective_from date NOT NULL,
  game_amount_cents integer NOT NULL CHECK (game_amount_cents >= 0),
  -- Centimes par km, valeur exacte (40.00 = 0,40 €/km). numeric : jamais de float.
  cents_per_km numeric(6, 2) NOT NULL CHECK (cents_per_km >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT scale_rate_scale_effective_from_key UNIQUE (scale_id, effective_from)
);

-- Barème par défaut d'un niveau pour un utilisateur. Absence de ligne = barème commun.
-- La FK composite garantit que le barème choisi appartient à l'utilisateur.
CREATE TABLE level_default_scale (
  user_id uuid NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  division_id uuid NOT NULL REFERENCES division (id) ON DELETE NO ACTION,
  scale_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT level_default_scale_pkey PRIMARY KEY (user_id, division_id),
  CONSTRAINT level_default_scale_scale_fk FOREIGN KEY (scale_id, user_id)
    REFERENCES scale (id, user_id) ON DELETE CASCADE
);

CREATE INDEX level_default_scale_scale_id_idx ON level_default_scale (scale_id);
CREATE INDEX level_default_scale_division_id_idx ON level_default_scale (division_id);

CREATE TRIGGER level_default_scale_set_updated_at BEFORE UPDATE ON level_default_scale
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- L'indemnité référence la ligne utilisée (montant de match + taux km du même barème).
-- FK simple (voir scale_rate) : « barème à moi ou commun » est vérifié par l'application.
-- NO ACTION : une ligne utilisée ne peut pas être supprimée.
ALTER TABLE compensation ADD COLUMN scale_rate_id uuid NOT NULL;
ALTER TABLE compensation ADD CONSTRAINT compensation_scale_rate_fk
  FOREIGN KEY (scale_rate_id) REFERENCES scale_rate (id) ON DELETE NO ACTION;
CREATE INDEX compensation_scale_rate_id_idx ON compensation (scale_rate_id);

-- Barème commun, sans ligne : l'admin saisit les montants dans l'application.
INSERT INTO scale (user_id, name) VALUES (NULL, 'Barème commun');

-- Down Migration

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM compensation) THEN
    RAISE EXCEPTION '009_baremes (down) : des indemnités existent ; retour arrière impossible sans perte';
  END IF;
END
$$;

DROP INDEX compensation_scale_rate_id_idx;
ALTER TABLE compensation DROP CONSTRAINT compensation_scale_rate_fk;
ALTER TABLE compensation DROP COLUMN scale_rate_id;

DROP TABLE level_default_scale;
DROP TABLE scale_rate;
DROP TABLE scale;

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

CREATE TABLE mileage_rate (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  effective_from date NOT NULL,
  cents_per_km numeric(6, 2) NOT NULL CHECK (cents_per_km >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mileage_rate_id_user_id_key UNIQUE (id, user_id),
  CONSTRAINT mileage_rate_user_effective_from_key UNIQUE (user_id, effective_from)
);

ALTER TABLE compensation ADD COLUMN scale_id uuid NOT NULL;
ALTER TABLE compensation ADD COLUMN mileage_rate_id uuid NOT NULL;
ALTER TABLE compensation ADD CONSTRAINT compensation_scale_fk
  FOREIGN KEY (scale_id, user_id) REFERENCES scale (id, user_id) ON DELETE NO ACTION;
ALTER TABLE compensation ADD CONSTRAINT compensation_mileage_rate_fk
  FOREIGN KEY (mileage_rate_id, user_id) REFERENCES mileage_rate (id, user_id) ON DELETE NO ACTION;
CREATE INDEX compensation_scale_id_idx ON compensation (scale_id);
CREATE INDEX compensation_mileage_rate_id_idx ON compensation (mileage_rate_id);