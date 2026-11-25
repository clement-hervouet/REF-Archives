-- Préparation de match partagée entre comptes. Exception explicite et limitée à
-- l'isolation par compte (§6.2) : le propriétaire d'un match partage sa préparation, match
-- par match, avec un arbitre du match dont la fiche collègue est liée à un compte.
--  * colleague_link : la fiche collègue d'un utilisateur pointe vers le compte de ce
--    collègue. Créé uniquement quand le collègue accepte un lien de partage (jamais par
--    recherche d'un compte : pas d'oracle d'existence, §6.5). Une fiche ne correspond qu'à
--    un compte, et un compte qu'à une fiche par propriétaire.
--  * preparation_share_link : lien à usage unique envoyé à la main par le propriétaire.
--    Seule l'empreinte SHA-256 du jeton est stockée, comme pour les invitations.
--  * game_share : un partage par match et par arbitre. Il porte les cases « déjà arbitrée »
--    du destinataire (celles du propriétaire restent dans `game_preparation`). L'accès
--    n'est valable que si la fiche est encore liée au compte destinataire, encore arbitre
--    du match, et que le match est actif et n'est pas un plateau : la règle d'accès est
--    dans `src/server/db/shared-preparations.ts`.
-- Toutes les clés vers les données du propriétaire sont composites (x_id, owner_user_id) :
-- un partage ne peut viser que le match ou la fiche de son propriétaire.
-- Effet sur les données existantes : aucun (nouvelles tables).

-- Up Migration

CREATE TABLE colleague_link (
  owner_user_id uuid NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  person_id uuid NOT NULL,
  linked_user_id uuid NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT colleague_link_pkey PRIMARY KEY (owner_user_id, person_id),
  CONSTRAINT colleague_link_owner_linked_key UNIQUE (owner_user_id, linked_user_id),
  CONSTRAINT colleague_link_not_self_check CHECK (owner_user_id <> linked_user_id),
  -- La fiche « moi » est refusée par l'application (elle n'est pas un collègue).
  CONSTRAINT colleague_link_person_fk FOREIGN KEY (person_id, owner_user_id)
    REFERENCES person (id, user_id) ON DELETE CASCADE
);

CREATE INDEX colleague_link_person_id_idx ON colleague_link (person_id);
CREATE INDEX colleague_link_linked_user_id_idx ON colleague_link (linked_user_id);

CREATE TABLE preparation_share_link (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  game_id uuid NOT NULL,
  person_id uuid NOT NULL,
  token_hash bytea NOT NULL,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  -- SET NULL : le compte qui a accepté peut être supprimé sans bloquer la ligne.
  accepted_by uuid REFERENCES "user" (id) ON DELETE SET NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT preparation_share_link_token_hash_key UNIQUE (token_hash),
  CONSTRAINT preparation_share_link_token_hash_length_check CHECK (octet_length(token_hash) = 32),
  CONSTRAINT preparation_share_link_expires_after_created_check CHECK (expires_at > created_at),
  CONSTRAINT preparation_share_link_single_outcome_check
    CHECK (accepted_at IS NULL OR revoked_at IS NULL),
  CONSTRAINT preparation_share_link_game_fk FOREIGN KEY (game_id, owner_user_id)
    REFERENCES game (id, user_id) ON DELETE CASCADE,
  CONSTRAINT preparation_share_link_person_fk FOREIGN KEY (person_id, owner_user_id)
    REFERENCES person (id, user_id) ON DELETE CASCADE
);

-- Un seul lien en attente par match et par arbitre : en créer un nouveau révoque l'ancien.
CREATE UNIQUE INDEX preparation_share_link_one_pending_key
  ON preparation_share_link (game_id, person_id)
  WHERE accepted_at IS NULL AND revoked_at IS NULL;
CREATE INDEX preparation_share_link_owner_user_id_idx ON preparation_share_link (owner_user_id);
CREATE INDEX preparation_share_link_person_id_idx ON preparation_share_link (person_id);
CREATE INDEX preparation_share_link_accepted_by_idx ON preparation_share_link (accepted_by);

CREATE TABLE game_share (
  owner_user_id uuid NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  game_id uuid NOT NULL,
  person_id uuid NOT NULL,
  -- Compte destinataire au moment du partage : un partage ne passe jamais à un autre
  -- compte si la fiche est liée plus tard à quelqu'un d'autre.
  recipient_user_id uuid NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  team1_already_refereed boolean NOT NULL DEFAULT false,
  team2_already_refereed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT game_share_pkey PRIMARY KEY (game_id, person_id),
  CONSTRAINT game_share_not_self_check CHECK (owner_user_id <> recipient_user_id),
  -- Le match supprimé définitivement (purge) emporte ses partages.
  CONSTRAINT game_share_game_fk FOREIGN KEY (game_id, owner_user_id)
    REFERENCES game (id, user_id) ON DELETE CASCADE,
  CONSTRAINT game_share_person_fk FOREIGN KEY (person_id, owner_user_id)
    REFERENCES person (id, user_id) ON DELETE CASCADE
);

CREATE INDEX game_share_owner_user_id_idx ON game_share (owner_user_id);
CREATE INDEX game_share_person_id_idx ON game_share (person_id);
CREATE INDEX game_share_recipient_user_id_idx ON game_share (recipient_user_id);

CREATE TRIGGER game_share_set_updated_at BEFORE UPDATE ON game_share
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Journal de sécurité : liaison et déliaison de comptes, création d'un lien de partage.
ALTER TYPE security_event_type ADD VALUE IF NOT EXISTS 'colleague_linked';
ALTER TYPE security_event_type ADD VALUE IF NOT EXISTS 'colleague_unlinked';
ALTER TYPE security_event_type ADD VALUE IF NOT EXISTS 'share_link_created';

-- Down Migration

-- Les valeurs ajoutées à `security_event_type` restent (voir 012_flux-ical.sql).
DROP TABLE game_share;
DROP TABLE preparation_share_link;
DROP TABLE colleague_link;
