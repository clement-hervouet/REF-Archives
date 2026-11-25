-- Préparation de match : auteur de la dernière modification. La préparation s'enregistre
-- désormais champ par champ (seuls les champs modifiés sont écrits, un champ changé
-- ailleurs entre-temps est signalé au lieu d'être écrasé) ; `updated_by` dit qui a écrit
-- en dernier. Aujourd'hui c'est toujours le propriétaire ; la préparation partagée
-- (collègues liés) en fera un autre compte.
--  * SET NULL : supprimer le compte de l'auteur n'efface pas la préparation d'un autre.
--  * NULL = auteur inconnu.
-- Effet sur les données existantes : les préparations déjà enregistrées prennent leur
-- propriétaire pour auteur.

-- Up Migration

ALTER TABLE game_preparation
  ADD COLUMN updated_by uuid REFERENCES "user" (id) ON DELETE SET NULL;

-- Sans le trigger : remplir l'auteur ne doit pas changer la date de dernière modification.
ALTER TABLE game_preparation DISABLE TRIGGER game_preparation_set_updated_at;
UPDATE game_preparation SET updated_by = user_id;
ALTER TABLE game_preparation ENABLE TRIGGER game_preparation_set_updated_at;

CREATE INDEX game_preparation_updated_by_idx ON game_preparation (updated_by);

-- Down Migration

DROP INDEX game_preparation_updated_by_idx;

ALTER TABLE game_preparation DROP COLUMN updated_by;
