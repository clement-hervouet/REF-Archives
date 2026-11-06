-- Bloc 10 : organisme qui verse l'indemnité (comité départemental, ligue, Fédération).
-- Il est déduit du niveau et de l'adresse du match par l'application (src/lib/payers.ts) ;
-- cette colonne ne garde que le choix explicite fait dans le formulaire (coupe, tournoi,
-- match délocalisé…). NULL = déduction automatique.
-- Clés : `federation`, `cd-<département>` (01 à 95, 2A, 2B, 971 à 974, 976),
-- `ligue-<identifiant>`. L'application valide la clé contre la liste exacte ; la base
-- refuse seulement une forme impossible.

-- Up Migration

ALTER TABLE compensation ADD COLUMN payer varchar(40);

ALTER TABLE compensation
  ADD CONSTRAINT compensation_payer_check CHECK (
    payer ~ '^(federation|cd-(0[1-9]|[1-8][0-9]|9[0-5]|2A|2B|97[1-46])|ligue-[a-z-]{2,30})$'
  );

-- Down Migration

ALTER TABLE compensation DROP CONSTRAINT compensation_payer_check;

ALTER TABLE compensation DROP COLUMN payer;
