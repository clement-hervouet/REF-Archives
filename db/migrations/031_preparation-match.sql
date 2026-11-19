-- Préparation de match (§15.4.10) : avant d'arbitrer, la situation des deux équipes et les
-- points d'attention du trio arbitral. Rattachée à un match complet, comme la note : au
-- plus une préparation active par match. Pas de préparation pour un plateau (vérifié par
-- l'application : la base ne voit pas l'équipe 2 depuis cette table).
--  * Nombre d'équipes de la poule : un seul pour le match, les deux équipes sont dans la
--    même poule.
--  * Par équipe : classement (position, victoires, défaites), notes sur les joueurs et sur
--    les coachs, case « déjà arbitrée cette saison ».
--  * Trio arbitral : placement, communication, gestion, table, critère contact et niveau de
--    tolérance (un texte chacun), case « observé ».
--  * Tous les champs sont facultatifs ; une préparation vide est refusée par l'application
--    (les cases cochées seules ne comptent pas).
-- Effet sur les données existantes : aucun (nouvelle table).

-- Up Migration

CREATE TABLE game_preparation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  game_id uuid NOT NULL,
  team_count smallint,
  team1_rank smallint,
  team1_wins smallint,
  team1_losses smallint,
  team1_players text,
  team1_coaches text,
  team1_already_refereed boolean NOT NULL DEFAULT false,
  team2_rank smallint,
  team2_wins smallint,
  team2_losses smallint,
  team2_players text,
  team2_coaches text,
  team2_already_refereed boolean NOT NULL DEFAULT false,
  crew_placement text,
  crew_communication text,
  crew_management text,
  crew_table text,
  crew_contact text,
  observed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Soft delete (§5.6) ; purge physique par job planifié.
  deleted_at timestamptz,
  -- Le match supprimé définitivement (purge) emporte sa préparation, comme sa note.
  CONSTRAINT game_preparation_game_fk FOREIGN KEY (game_id, user_id)
    REFERENCES game (id, user_id) ON DELETE CASCADE,
  -- Bornes alignées sur `src/lib/preparation-form-fields.ts`.
  CONSTRAINT game_preparation_team_count_check CHECK (team_count BETWEEN 2 AND 50),
  CONSTRAINT game_preparation_team1_rank_check CHECK (
    team1_rank BETWEEN 1 AND 50 AND (team_count IS NULL OR team1_rank <= team_count)
  ),
  CONSTRAINT game_preparation_team2_rank_check CHECK (
    team2_rank BETWEEN 1 AND 50 AND (team_count IS NULL OR team2_rank <= team_count)
  ),
  CONSTRAINT game_preparation_record_check CHECK (
    team1_wins BETWEEN 0 AND 99 AND team1_losses BETWEEN 0 AND 99
    AND team2_wins BETWEEN 0 AND 99 AND team2_losses BETWEEN 0 AND 99
  ),
  -- Texte vide = NULL (l'application l'assure) ; 4 096 caractères au plus, comme la note.
  CONSTRAINT game_preparation_texts_check CHECK (
    (team1_players IS NULL OR (team1_players ~ '\S' AND char_length(team1_players) <= 4096))
    AND (team1_coaches IS NULL OR (team1_coaches ~ '\S' AND char_length(team1_coaches) <= 4096))
    AND (team2_players IS NULL OR (team2_players ~ '\S' AND char_length(team2_players) <= 4096))
    AND (team2_coaches IS NULL OR (team2_coaches ~ '\S' AND char_length(team2_coaches) <= 4096))
    AND (crew_placement IS NULL
      OR (crew_placement ~ '\S' AND char_length(crew_placement) <= 4096))
    AND (crew_communication IS NULL
      OR (crew_communication ~ '\S' AND char_length(crew_communication) <= 4096))
    AND (crew_management IS NULL
      OR (crew_management ~ '\S' AND char_length(crew_management) <= 4096))
    AND (crew_table IS NULL OR (crew_table ~ '\S' AND char_length(crew_table) <= 4096))
    AND (crew_contact IS NULL OR (crew_contact ~ '\S' AND char_length(crew_contact) <= 4096))
  )
);

CREATE UNIQUE INDEX game_preparation_one_active_per_game_key ON game_preparation (game_id)
  WHERE deleted_at IS NULL;
CREATE INDEX game_preparation_user_id_idx ON game_preparation (user_id);
CREATE INDEX game_preparation_deleted_at_idx ON game_preparation (deleted_at)
  WHERE deleted_at IS NOT NULL;

CREATE TRIGGER game_preparation_set_updated_at BEFORE UPDATE ON game_preparation
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Down Migration

DROP TABLE game_preparation;
