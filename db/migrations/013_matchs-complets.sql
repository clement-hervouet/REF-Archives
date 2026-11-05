-- Bloc 9 : matchs complets et notes de match.
-- Un match complet (`game`) ajoute à un match les officiels (arbitres 1 à 3 dans l'ordre
-- officiel, observateur) et une note. Il est créé depuis une indemnité (ou seul) ; quand les
-- deux sont liés (`compensation.game_id`, §3.8), l'application synchronise les informations
-- communes (date, niveau, équipes, adresse) dans la même transaction.
--  * person : l'utilisateur lui-même (`is_self`, affiché « Moi », sans nom obligatoire) et ses
--    collègues, en fiche nom seul. `has_account` est une simple case informative : aucun lien
--    entre comptes (§1.3, §6.5), jamais de recherche d'un compte existant.
--  * game : pas deux fois la même personne parmi les officiels, et pas d'arbitre 3 sans
--    arbitre 2. Les FK vers les arbitres 2 et 3 et l'observateur passent en NO ACTION :
--    un SET NULL sur l'arbitre 2 laisserait un arbitre 3 seul ; une fiche utilisée par un
--    match ne se supprime donc pas (comme une ligne de barème utilisée, §3.7).
--  * note : confiance et stress de 1 à 5 (§12 tranché au bloc 9), tous les champs
--    facultatifs ; une note vide est refusée par l'application (les clips sont dans une
--    autre table, la base ne peut pas le vérifier seule).
--  * note_clip : liens externes uniquement (§1.3), http(s) seulement (§6.3), jamais
--    résolus côté serveur (§6.4 A10). 10 liens au plus par note (position 0 à 9).

-- Up Migration

ALTER TABLE person ADD COLUMN has_account boolean NOT NULL DEFAULT false;

-- La fiche « moi » n'a pas besoin de nom (le compte n'en stocke pas) ; un collègue a au
-- moins un nom de famille, le prénom est facultatif (§6.5 : minimum sur des tiers).
ALTER TABLE person
  ALTER COLUMN firstname DROP NOT NULL,
  ALTER COLUMN lastname DROP NOT NULL;

ALTER TABLE person
  ADD CONSTRAINT person_name_check CHECK (is_self OR lastname IS NOT NULL),
  ADD CONSTRAINT person_firstname_not_blank_check CHECK (firstname IS NULL OR firstname ~ '\S'),
  ADD CONSTRAINT person_lastname_not_blank_check CHECK (lastname IS NULL OR lastname ~ '\S');

ALTER TABLE game
  ADD CONSTRAINT game_referee_order_check CHECK (referee3_id IS NULL OR referee2_id IS NOT NULL),
  ADD CONSTRAINT game_officials_distinct_check CHECK (
    referee1_id IS DISTINCT FROM referee2_id
    AND referee1_id IS DISTINCT FROM referee3_id
    AND referee1_id IS DISTINCT FROM observer_id
    AND (referee2_id IS NULL OR (
      referee2_id IS DISTINCT FROM referee3_id AND referee2_id IS DISTINCT FROM observer_id
    ))
    AND (referee3_id IS NULL OR referee3_id IS DISTINCT FROM observer_id)
  );

ALTER TABLE game
  DROP CONSTRAINT game_referee2_fk,
  DROP CONSTRAINT game_referee3_fk,
  DROP CONSTRAINT game_observer_fk;

ALTER TABLE game
  ADD CONSTRAINT game_referee2_fk FOREIGN KEY (referee2_id, user_id)
    REFERENCES person (id, user_id) ON DELETE NO ACTION,
  ADD CONSTRAINT game_referee3_fk FOREIGN KEY (referee3_id, user_id)
    REFERENCES person (id, user_id) ON DELETE NO ACTION,
  ADD CONSTRAINT game_observer_fk FOREIGN KEY (observer_id, user_id)
    REFERENCES person (id, user_id) ON DELETE NO ACTION;

ALTER TABLE note
  ALTER COLUMN body DROP NOT NULL,
  ADD COLUMN confidence smallint,
  ADD COLUMN stress smallint;

ALTER TABLE note
  ADD CONSTRAINT note_body_not_blank_check CHECK (body IS NULL OR body ~ '\S'),
  ADD CONSTRAINT note_confidence_range_check CHECK (confidence BETWEEN 1 AND 5),
  ADD CONSTRAINT note_stress_range_check CHECK (stress BETWEEN 1 AND 5);

CREATE TABLE note_clip (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  note_id uuid NOT NULL,
  -- Ordre d'affichage choisi par l'utilisateur.
  position smallint NOT NULL,
  url varchar(2048) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT note_clip_note_fk FOREIGN KEY (note_id, user_id)
    REFERENCES note (id, user_id) ON DELETE CASCADE,
  CONSTRAINT note_clip_position_key UNIQUE (note_id, position),
  CONSTRAINT note_clip_position_range_check CHECK (position BETWEEN 0 AND 9),
  -- Filet de sécurité : l'application normalise déjà l'URL (schéma en minuscules).
  CONSTRAINT note_clip_url_scheme_check CHECK (url ~ '^https?://\S+$')
);

CREATE INDEX note_clip_user_id_idx ON note_clip (user_id);

-- Down Migration

-- Une note sans texte ou un collègue sans nom ne peuvent pas revenir au modèle précédent
-- sans être perdus : on refuse plutôt que d'inventer des valeurs.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM note WHERE body IS NULL) THEN
    RAISE EXCEPTION '013_matchs-complets (down) : des notes sans texte existent';
  END IF;
  IF EXISTS (SELECT 1 FROM person WHERE firstname IS NULL OR lastname IS NULL) THEN
    RAISE EXCEPTION '013_matchs-complets (down) : des fiches sans prénom ou sans nom existent';
  END IF;
END
$$;

DROP TABLE note_clip;

ALTER TABLE note
  DROP CONSTRAINT note_stress_range_check,
  DROP CONSTRAINT note_confidence_range_check,
  DROP CONSTRAINT note_body_not_blank_check;

ALTER TABLE note
  DROP COLUMN stress,
  DROP COLUMN confidence,
  ALTER COLUMN body SET NOT NULL;

ALTER TABLE game
  DROP CONSTRAINT game_observer_fk,
  DROP CONSTRAINT game_referee3_fk,
  DROP CONSTRAINT game_referee2_fk;

ALTER TABLE game
  ADD CONSTRAINT game_referee2_fk FOREIGN KEY (referee2_id, user_id)
    REFERENCES person (id, user_id) ON DELETE SET NULL (referee2_id),
  ADD CONSTRAINT game_referee3_fk FOREIGN KEY (referee3_id, user_id)
    REFERENCES person (id, user_id) ON DELETE SET NULL (referee3_id),
  ADD CONSTRAINT game_observer_fk FOREIGN KEY (observer_id, user_id)
    REFERENCES person (id, user_id) ON DELETE SET NULL (observer_id);

ALTER TABLE game
  DROP CONSTRAINT game_officials_distinct_check,
  DROP CONSTRAINT game_referee_order_check;

ALTER TABLE person
  DROP CONSTRAINT person_lastname_not_blank_check,
  DROP CONSTRAINT person_firstname_not_blank_check,
  DROP CONSTRAINT person_name_check;

ALTER TABLE person
  ALTER COLUMN firstname SET NOT NULL,
  ALTER COLUMN lastname SET NOT NULL;

ALTER TABLE person DROP COLUMN has_account;
