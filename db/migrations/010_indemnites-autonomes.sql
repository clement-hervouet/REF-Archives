-- Bloc 6 : l'indemnité devient autonome.
-- Une indemnité porte elle-même les informations du match indemnisé (date et heure, niveau,
-- équipes, adresse) et n'est plus forcément rattachée à un `game`. Le match complet
-- (arbitres, observateur, notes) sera développé dans un bloc ultérieur ; le lien
-- compensation -> game reste possible mais facultatif.
--  * address_id : par défaut l'adresse du club de l'équipe 1, une autre en cas d'exception.
--    Le choix est fait par l'application ; la base stocke l'adresse retenue.
--  * division_id : niveau du match, qui présélectionne le barème (bloc 5).
--  * club.licence devient facultatif : un club est créé à la volée depuis le formulaire
--    d'indemnité, et son numéro d'affiliation est rarement connu à ce moment (§6.5 : minimum).

-- Up Migration

ALTER TABLE club ALTER COLUMN licence DROP NOT NULL;

ALTER TABLE compensation
  ADD COLUMN starts_at timestamptz,
  ADD COLUMN division_id uuid,
  ADD COLUMN team1_id uuid,
  ADD COLUMN team2_id uuid,
  ADD COLUMN address_id uuid;

-- Indemnités existantes (seed de dev) : leurs informations viennent du match lié.
UPDATE compensation c
SET
  starts_at = g.starts_at,
  division_id = g.division_id,
  team1_id = g.team1_id,
  team2_id = g.team2_id,
  address_id = g.address_id
FROM game g
WHERE g.id = c.game_id AND g.user_id = c.user_id;

ALTER TABLE compensation
  ALTER COLUMN starts_at SET NOT NULL,
  ALTER COLUMN division_id SET NOT NULL,
  ALTER COLUMN team1_id SET NOT NULL,
  ALTER COLUMN team2_id SET NOT NULL,
  ALTER COLUMN address_id SET NOT NULL;

ALTER TABLE compensation
  ADD CONSTRAINT compensation_division_fk FOREIGN KEY (division_id)
    REFERENCES division (id) ON DELETE NO ACTION,
  ADD CONSTRAINT compensation_team1_fk FOREIGN KEY (team1_id, user_id)
    REFERENCES team (id, user_id) ON DELETE NO ACTION,
  ADD CONSTRAINT compensation_team2_fk FOREIGN KEY (team2_id, user_id)
    REFERENCES team (id, user_id) ON DELETE NO ACTION,
  ADD CONSTRAINT compensation_address_fk FOREIGN KEY (address_id, user_id)
    REFERENCES address (id, user_id) ON DELETE NO ACTION,
  ADD CONSTRAINT compensation_teams_differ_check CHECK (team1_id <> team2_id),
  -- Aller-retour plafonné à 4 000 km : au-delà, c'est une erreur de saisie.
  ADD CONSTRAINT compensation_distance_max_check CHECK (distance_m <= 4000000);

-- Lien vers un match complet : facultatif. Supprimer un match ne supprime plus
-- l'indemnité (elle porte ses propres informations), le lien est seulement effacé.
ALTER TABLE compensation DROP CONSTRAINT compensation_game_fk;
ALTER TABLE compensation ALTER COLUMN game_id DROP NOT NULL;
ALTER TABLE compensation
  ADD CONSTRAINT compensation_game_fk FOREIGN KEY (game_id, user_id)
    REFERENCES game (id, user_id) ON DELETE SET NULL (game_id);

-- Liste et totaux mensuels d'un utilisateur par date (requête principale), hors supprimées.
CREATE INDEX compensation_user_starts_at_idx ON compensation (user_id, starts_at DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX compensation_division_id_idx ON compensation (division_id);
CREATE INDEX compensation_team1_id_idx ON compensation (team1_id);
CREATE INDEX compensation_team2_id_idx ON compensation (team2_id);
CREATE INDEX compensation_address_id_idx ON compensation (address_id);

-- Down Migration

-- Une indemnité sans match ne peut pas revenir au modèle précédent sans être perdue.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM compensation WHERE game_id IS NULL) THEN
    RAISE EXCEPTION '010_indemnites-autonomes (down) : des indemnités sans match existent';
  END IF;
END
$$;

DROP INDEX compensation_address_id_idx;
DROP INDEX compensation_team2_id_idx;
DROP INDEX compensation_team1_id_idx;
DROP INDEX compensation_division_id_idx;
DROP INDEX compensation_user_starts_at_idx;

ALTER TABLE compensation DROP CONSTRAINT compensation_game_fk;
ALTER TABLE compensation ALTER COLUMN game_id SET NOT NULL;
ALTER TABLE compensation
  ADD CONSTRAINT compensation_game_fk FOREIGN KEY (game_id, user_id)
    REFERENCES game (id, user_id) ON DELETE CASCADE;

ALTER TABLE compensation
  DROP CONSTRAINT compensation_distance_max_check,
  DROP CONSTRAINT compensation_teams_differ_check,
  DROP CONSTRAINT compensation_address_fk,
  DROP CONSTRAINT compensation_team2_fk,
  DROP CONSTRAINT compensation_team1_fk,
  DROP CONSTRAINT compensation_division_fk;

ALTER TABLE compensation
  DROP COLUMN address_id,
  DROP COLUMN team2_id,
  DROP COLUMN team1_id,
  DROP COLUMN division_id,
  DROP COLUMN starts_at;

-- Échoue volontairement si un club sans numéro existe : on ne l'invente pas.
ALTER TABLE club ALTER COLUMN licence SET NOT NULL;
