-- Up Migration

CREATE TABLE game (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  -- Le niveau du match (donc son prix) vient du match, pas de la division de l'une des équipes.
  division_id uuid NOT NULL REFERENCES division (id) ON DELETE NO ACTION,
  address_id uuid NOT NULL,
  team1_id uuid NOT NULL,
  team2_id uuid NOT NULL,
  referee1_id uuid NOT NULL,
  referee2_id uuid,
  referee3_id uuid,
  observer_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Soft delete (§5.6) ; purge physique par job planifié.
  deleted_at timestamptz,
  CONSTRAINT game_id_user_id_key UNIQUE (id, user_id),
  CONSTRAINT game_teams_differ_check CHECK (team1_id <> team2_id),
  CONSTRAINT game_address_fk FOREIGN KEY (address_id, user_id)
    REFERENCES address (id, user_id) ON DELETE NO ACTION,
  CONSTRAINT game_team1_fk FOREIGN KEY (team1_id, user_id)
    REFERENCES team (id, user_id) ON DELETE NO ACTION,
  CONSTRAINT game_team2_fk FOREIGN KEY (team2_id, user_id)
    REFERENCES team (id, user_id) ON DELETE NO ACTION,
  CONSTRAINT game_referee1_fk FOREIGN KEY (referee1_id, user_id)
    REFERENCES person (id, user_id) ON DELETE NO ACTION,
  CONSTRAINT game_referee2_fk FOREIGN KEY (referee2_id, user_id)
    REFERENCES person (id, user_id) ON DELETE SET NULL (referee2_id),
  CONSTRAINT game_referee3_fk FOREIGN KEY (referee3_id, user_id)
    REFERENCES person (id, user_id) ON DELETE SET NULL (referee3_id),
  CONSTRAINT game_observer_fk FOREIGN KEY (observer_id, user_id)
    REFERENCES person (id, user_id) ON DELETE SET NULL (observer_id)
);

-- Liste des matchs d'un utilisateur par date (requête principale), hors supprimés.
CREATE INDEX game_user_starts_at_idx ON game (user_id, starts_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX game_deleted_at_idx ON game (deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX game_division_id_idx ON game (division_id);
CREATE INDEX game_address_id_idx ON game (address_id);
CREATE INDEX game_team1_id_idx ON game (team1_id);
CREATE INDEX game_team2_id_idx ON game (team2_id);
CREATE INDEX game_referee1_id_idx ON game (referee1_id);
CREATE INDEX game_referee2_id_idx ON game (referee2_id);
CREATE INDEX game_referee3_id_idx ON game (referee3_id);
CREATE INDEX game_observer_id_idx ON game (observer_id);

CREATE TRIGGER game_set_updated_at BEFORE UPDATE ON game
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- note : confiance, stress et liens de clips arriveront au bloc 9 (échelles à fixer, §12).
CREATE TABLE note (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  game_id uuid NOT NULL,
  body text NOT NULL CHECK (char_length(body) <= 4096),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT note_id_user_id_key UNIQUE (id, user_id),
  CONSTRAINT note_game_fk FOREIGN KEY (game_id, user_id)
    REFERENCES game (id, user_id) ON DELETE CASCADE
);

-- Hypothèse : au plus une note active par match.
CREATE UNIQUE INDEX note_one_active_per_game_key ON note (game_id) WHERE deleted_at IS NULL;
CREATE INDEX note_user_id_idx ON note (user_id);
CREATE INDEX note_deleted_at_idx ON note (deleted_at) WHERE deleted_at IS NOT NULL;

CREATE TRIGGER note_set_updated_at BEFORE UPDATE ON note
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- compensation : référence le barème et le taux km utilisés (lignes immuables, donc l'historique
-- est conservé). Le montant n'est pas stocké : il est calculé par une fonction pure et testée.
-- Cohérence scale.division_id = game.division_id et date d'application : vérifiée par l'application (bloc 6).
CREATE TABLE compensation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  game_id uuid NOT NULL,
  scale_id uuid NOT NULL,
  mileage_rate_id uuid NOT NULL,
  distance_m integer NOT NULL DEFAULT 0 CHECK (distance_m >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT compensation_id_user_id_key UNIQUE (id, user_id),
  CONSTRAINT compensation_game_fk FOREIGN KEY (game_id, user_id)
    REFERENCES game (id, user_id) ON DELETE CASCADE,
  CONSTRAINT compensation_scale_fk FOREIGN KEY (scale_id, user_id)
    REFERENCES scale (id, user_id) ON DELETE NO ACTION,
  CONSTRAINT compensation_mileage_rate_fk FOREIGN KEY (mileage_rate_id, user_id)
    REFERENCES mileage_rate (id, user_id) ON DELETE NO ACTION
);

CREATE UNIQUE INDEX compensation_one_active_per_game_key ON compensation (game_id) WHERE deleted_at IS NULL;
CREATE INDEX compensation_user_id_idx ON compensation (user_id);
CREATE INDEX compensation_scale_id_idx ON compensation (scale_id);
CREATE INDEX compensation_mileage_rate_id_idx ON compensation (mileage_rate_id);
CREATE INDEX compensation_deleted_at_idx ON compensation (deleted_at) WHERE deleted_at IS NOT NULL;

CREATE TRIGGER compensation_set_updated_at BEFORE UPDATE ON compensation
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Down Migration

DROP TABLE compensation;
DROP TABLE note;
DROP TABLE game;