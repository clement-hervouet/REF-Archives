-- Plusieurs salles par club (§15.4.1) : beaucoup de clubs reçoivent dans plusieurs gymnases.
--  * address.name : nom de la salle (« Gymnase de la Courrouze »), facultatif. Vide = NULL,
--    comme la rue et la ville (migration 022).
--  * club.address_id reste l'adresse principale du club : salle proposée par défaut pour un
--    match où il reçoit (équipe 1), et adresse affichée partout où le club apparaît.
--  * club_venue : les AUTRES salles du club (jamais la principale, l'application y veille).
--    Lien plutôt que colonne club_id sur address : une même salle peut servir à plusieurs
--    clubs (gymnase partagé, entente), et un doublé (§15.4.5) se repère à la même adresse.
--    Le lien part avec le club (CASCADE) ; une adresse liée ne peut pas être supprimée
--    (NO ACTION, vérifié en fin d'instruction : la suppression de compte passe).
-- Effet sur les données existantes : les adresses d'exception déjà utilisées pour des
-- matchs ou des indemnités actifs deviennent des salles du club de l'équipe 1. Rien n'est
-- réécrit : ni les clubs, ni les adresses, ni les matchs.

-- Up Migration

ALTER TABLE address
  ADD COLUMN name varchar(255),
  ADD CONSTRAINT address_name_not_blank_check CHECK (name IS NULL OR btrim(name) <> '');

CREATE TABLE club_venue (
  club_id uuid NOT NULL,
  address_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (club_id, address_id),
  CONSTRAINT club_venue_club_fk FOREIGN KEY (club_id, user_id)
    REFERENCES club (id, user_id) ON DELETE CASCADE,
  CONSTRAINT club_venue_address_fk FOREIGN KEY (address_id, user_id)
    REFERENCES address (id, user_id) ON DELETE NO ACTION
);

CREATE INDEX club_venue_address_id_idx ON club_venue (address_id);
CREATE INDEX club_venue_user_id_idx ON club_venue (user_id);

INSERT INTO club_venue (club_id, address_id, user_id)
SELECT DISTINCT c.id, m.address_id, c.user_id
FROM (
  SELECT user_id, team1_id, address_id FROM compensation WHERE deleted_at IS NULL
  UNION
  SELECT user_id, team1_id, address_id FROM game WHERE deleted_at IS NULL
) m
JOIN team t ON t.id = m.team1_id AND t.user_id = m.user_id
JOIN club c ON c.id = t.club_id AND c.user_id = t.user_id
WHERE m.address_id <> c.address_id;

-- Down Migration

DROP TABLE club_venue;

ALTER TABLE address
  DROP CONSTRAINT address_name_not_blank_check,
  DROP COLUMN name;
