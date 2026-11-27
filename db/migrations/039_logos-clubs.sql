-- Logos des clubs (annuaire FFBB), à l'essai sur les indemnités.
--  * club.ffbb_id : identifiant FFBB du club (chaîne de chiffres), posé quand le club est
--    choisi dans l'annuaire ou lié depuis l'onglet « Clubs ». Facultatif : un club saisi à
--    la main n'en a pas.
--  * club.ffbb_logo_uuid : logo du club côté FFBB (UUID de l'asset), `NULL` si la FFBB n'en
--    donne pas.
--  * club.color : couleur du club (`gradient_color` de la FFBB, `#rrggbb` en minuscules),
--    fond de la pastille.
--    Logo et couleur n'existent qu'avec un identifiant FFBB.
--  * club_logo : les octets du logo, téléchargés une fois côté serveur (WebP, PNG ou JPEG,
--    200 Ko au plus) et servis ensuite par l'application. `logo_uuid` dit de quel logo il
--    s'agit : un autre UUID sur le club = logo à retélécharger. `bytes` NULL = échec du
--    téléchargement à `fetched_at` (réessayé plus tard), la pastille montre les initiales.
-- Effet sur les données existantes : aucun ; les clubs actuels n'ont ni logo ni couleur.

-- Up Migration

ALTER TABLE club
  ADD COLUMN ffbb_id varchar(20),
  ADD COLUMN ffbb_logo_uuid uuid,
  ADD COLUMN color char(7),
  ADD CONSTRAINT club_ffbb_id_check CHECK (ffbb_id IS NULL OR ffbb_id ~ '^[0-9]{1,20}$'),
  ADD CONSTRAINT club_color_check CHECK (color IS NULL OR color ~ '^#[0-9a-f]{6}$'),
  ADD CONSTRAINT club_ffbb_link_check
    CHECK (ffbb_id IS NOT NULL OR (ffbb_logo_uuid IS NULL AND color IS NULL));

CREATE TABLE club_logo (
  club_id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  logo_uuid uuid NOT NULL,
  mime varchar(20),
  bytes bytea,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT club_logo_club_fk FOREIGN KEY (club_id, user_id)
    REFERENCES club (id, user_id) ON DELETE CASCADE,
  CONSTRAINT club_logo_mime_check
    CHECK (mime IS NULL OR mime IN ('image/webp', 'image/png', 'image/jpeg')),
  CONSTRAINT club_logo_bytes_check
    CHECK ((mime IS NULL) = (bytes IS NULL) AND (bytes IS NULL OR octet_length(bytes) BETWEEN 1 AND 204800))
);

CREATE INDEX club_logo_user_id_idx ON club_logo (user_id);

-- Down Migration

DROP TABLE club_logo;

ALTER TABLE club
  DROP CONSTRAINT club_ffbb_link_check,
  DROP CONSTRAINT club_color_check,
  DROP CONSTRAINT club_ffbb_id_check,
  DROP COLUMN color,
  DROP COLUMN ffbb_logo_uuid,
  DROP COLUMN ffbb_id;
