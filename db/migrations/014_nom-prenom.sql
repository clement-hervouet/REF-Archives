-- Bloc 10 : nom et prénom du titulaire du compte.
-- Ils servent à l'interface (« Bonjour {prénom} », prénom en haut du menu) et sont
-- obligatoires pour utiliser l'application (§3.12). Les colonnes restent NULL en base :
-- les comptes déjà créés (et le premier admin créé par `pnpm admin:create`) n'en ont pas,
-- et l'application les fait compléter avant toute autre page.
--  * Les deux sont renseignés ensemble ou pas du tout : jamais un prénom sans nom.
--  * Jamais de chaîne vide ni faite d'espaces (l'application les retire déjà, la base
--    le garantit aussi), 100 caractères au plus (comme les fiches `person`).

-- Up Migration

ALTER TABLE "user"
  ADD COLUMN firstname varchar(100),
  ADD COLUMN lastname varchar(100);

ALTER TABLE "user"
  ADD CONSTRAINT user_name_pair_check CHECK ((firstname IS NULL) = (lastname IS NULL)),
  ADD CONSTRAINT user_firstname_not_blank_check CHECK (btrim(firstname) <> ''),
  ADD CONSTRAINT user_lastname_not_blank_check CHECK (btrim(lastname) <> '');

-- Down Migration

ALTER TABLE "user"
  DROP CONSTRAINT user_lastname_not_blank_check,
  DROP CONSTRAINT user_firstname_not_blank_check,
  DROP CONSTRAINT user_name_pair_check;

ALTER TABLE "user"
  DROP COLUMN lastname,
  DROP COLUMN firstname;
