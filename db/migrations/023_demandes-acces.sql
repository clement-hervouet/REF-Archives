-- Feature « Demandes d'accès » (§15.4.4) : une personne sans compte demande un accès depuis la
-- page de connexion ; un admin l'invite ou refuse.
--  * Une seule demande EN ATTENTE par email (index unique partiel) : une nouvelle demande pour
--    la même adresse est ignorée tant que la première n'est pas traitée.
--  * `decision` et `decided_at` vont ensemble : tous deux NULL tant que la demande attend.
--  * `decided_by` : SET NULL, la demande survit à la suppression du compte de l'admin.
--  * Effet sur les données existantes : aucun (nouvelle table, nouvelles valeurs d'énumération).
--  * ALTER TYPE … ADD VALUE dans une transaction : accepté (PostgreSQL ≥ 12) tant que la
--    valeur n'y est pas utilisée ; IF NOT EXISTS rend la migration rejouable.

-- Up Migration

ALTER TYPE security_event_type ADD VALUE IF NOT EXISTS 'access_requested';
ALTER TYPE security_event_type ADD VALUE IF NOT EXISTS 'access_request_refused';

CREATE TABLE access_request (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email varchar(255) NOT NULL,
  firstname varchar(100) NOT NULL,
  lastname varchar(100) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  decided_by uuid REFERENCES "user" (id) ON DELETE SET NULL,
  decision text,
  CONSTRAINT access_request_firstname_check CHECK (btrim(firstname) <> ''),
  CONSTRAINT access_request_lastname_check CHECK (btrim(lastname) <> ''),
  CONSTRAINT access_request_decision_check CHECK (decision IN ('invited', 'refused')),
  -- Décision et date de décision : présentes ensemble ou absentes ensemble.
  CONSTRAINT access_request_decided_check CHECK ((decision IS NULL) = (decided_at IS NULL))
);

-- Une seule demande en attente par adresse (insertion avec ON CONFLICT … DO NOTHING).
CREATE UNIQUE INDEX access_request_pending_email_key ON access_request (lower(email))
  WHERE decided_at IS NULL;
-- Liste et compte des demandes en attente, purge des demandes jamais traitées.
CREATE INDEX access_request_created_at_idx ON access_request (created_at);

-- Down Migration

DROP TABLE access_request;
-- Les valeurs ajoutées à security_event_type restent (voir 012_flux-ical.sql).
