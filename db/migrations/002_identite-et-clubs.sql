-- Up Migration

-- Conventions de ce fichier et des suivants :
--  * PK uuid partout ; une FK a toujours le type de la PK référencée (§5.6).
--  * Chaque ressource porte user_id. Chaque table possédée expose UNIQUE (id, user_id) pour que
--    les FK composites (x_id, user_id) interdisent de référencer la ressource d'un autre utilisateur.
--  * ON DELETE toujours explicite. NO ACTION (et non RESTRICT) pour protéger les références métier :
--    il est vérifié en fin d'instruction, donc la suppression de compte (CASCADE depuis "user")
--    ne se bloque pas elle-même.
--  * Dates en timestamptz (UTC).

CREATE TABLE "user" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email varchar(255) NOT NULL,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Unicité insensible à la casse : on ne crée pas deux comptes pour "A@x.fr" et "a@x.fr".
CREATE UNIQUE INDEX user_email_lower_key ON "user" (lower(email));

CREATE TRIGGER user_set_updated_at BEFORE UPDATE ON "user"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE address (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  postal_code varchar(255) NOT NULL,
  city varchar(255) NOT NULL,
  street varchar(255) NOT NULL,
  number varchar(255),
  country varchar(255),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT address_id_user_id_key UNIQUE (id, user_id)
);

CREATE INDEX address_user_id_idx ON address (user_id);

CREATE TRIGGER address_set_updated_at BEFORE UPDATE ON address
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- person : l'arbitre lui-même (is_self), ses collègues, observateurs et correspondants de club.
-- Coordonnées facultatives : on ne collecte que le strict minimum sur des tiers (§6.5).
-- La FK vers club est ajoutée plus bas, une fois club créée (dépendance circulaire).
CREATE TABLE person (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  type person_type NOT NULL,
  is_self boolean NOT NULL DEFAULT false,
  firstname varchar(255) NOT NULL,
  lastname varchar(255) NOT NULL,
  licence varchar(255),
  address_id uuid,
  club_id uuid,
  phone varchar(255),
  email varchar(255),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT person_id_user_id_key UNIQUE (id, user_id),
  -- SET NULL (colonne) : n'efface que address_id, jamais user_id (NOT NULL).
  CONSTRAINT person_address_fk FOREIGN KEY (address_id, user_id)
    REFERENCES address (id, user_id) ON DELETE SET NULL (address_id)
);

-- Une seule fiche "moi" par utilisateur.
CREATE UNIQUE INDEX person_one_self_per_user_key ON person (user_id) WHERE is_self;
CREATE INDEX person_user_id_idx ON person (user_id);
CREATE INDEX person_address_id_idx ON person (address_id);
CREATE INDEX person_club_id_idx ON person (club_id);

CREATE TRIGGER person_set_updated_at BEFORE UPDATE ON person
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE club (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  address_id uuid NOT NULL,
  name varchar(255) NOT NULL,
  licence varchar(255) NOT NULL,
  -- Nullable : casse le cycle person <-> club (on peut créer l'un avant l'autre).
  correspondent_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT club_id_user_id_key UNIQUE (id, user_id),
  CONSTRAINT club_address_fk FOREIGN KEY (address_id, user_id)
    REFERENCES address (id, user_id) ON DELETE NO ACTION,
  CONSTRAINT club_correspondent_fk FOREIGN KEY (correspondent_id, user_id)
    REFERENCES person (id, user_id) ON DELETE SET NULL (correspondent_id)
);

CREATE INDEX club_user_id_idx ON club (user_id);
CREATE INDEX club_address_id_idx ON club (address_id);
CREATE INDEX club_correspondent_id_idx ON club (correspondent_id);

CREATE TRIGGER club_set_updated_at BEFORE UPDATE ON club
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE person
  ADD CONSTRAINT person_club_fk FOREIGN KEY (club_id, user_id)
    REFERENCES club (id, user_id) ON DELETE SET NULL (club_id);

-- division : référentiel global (sans propriétaire), identique pour tous les utilisateurs.
CREATE TABLE division (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  division division_division NOT NULL,
  type division_type NOT NULL,
  level division_level NOT NULL,
  CONSTRAINT division_division_type_level_key UNIQUE (division, type, level)
);

CREATE TABLE team (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  club_id uuid NOT NULL,
  division_id uuid NOT NULL REFERENCES division (id) ON DELETE NO ACTION,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT team_id_user_id_key UNIQUE (id, user_id),
  -- Une équipe n'existe pas sans son club.
  CONSTRAINT team_club_fk FOREIGN KEY (club_id, user_id)
    REFERENCES club (id, user_id) ON DELETE CASCADE
);

CREATE INDEX team_user_id_idx ON team (user_id);
CREATE INDEX team_club_id_idx ON team (club_id);
CREATE INDEX team_division_id_idx ON team (division_id);

CREATE TRIGGER team_set_updated_at BEFORE UPDATE ON team
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Down Migration

DROP TABLE team;
DROP TABLE division;
ALTER TABLE person DROP CONSTRAINT person_club_fk;
DROP TABLE club;
DROP TABLE person;
DROP TABLE address;
DROP TABLE "user";