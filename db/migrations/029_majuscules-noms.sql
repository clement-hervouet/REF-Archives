-- Noms en majuscules : nom des clubs et nom de famille des comptes (et des demandes d'accès
-- en attente), comme l'application les enregistre désormais (schémas Zod `clubNameSchema` et
-- `nameSchema("lastname")`).
--  * `upper()` suit la collation de la base (en_US.utf8 dans l'image postgres officielle) :
--    les lettres accentuées passent aussi en majuscules (é → É).
--  * Les fiches `person` (collègues) ne changent pas : seul le nom des comptes est concerné.
-- Effet sur les données existantes : les noms de club et les noms de famille déjà saisis
-- passent en majuscules ; rien d'autre ne change (le tri des clubs se fait déjà sur
-- `lower(name)`).

-- Up Migration

UPDATE club SET name = upper(name) WHERE name <> upper(name);

UPDATE "user" SET lastname = upper(lastname) WHERE lastname <> upper(lastname);

UPDATE access_request SET lastname = upper(lastname) WHERE lastname <> upper(lastname);

-- Down Migration

-- Rien à défaire : la casse d'origine n'est pas conservée (retour arrière par restauration
-- de la sauvegarde, §3.18).
