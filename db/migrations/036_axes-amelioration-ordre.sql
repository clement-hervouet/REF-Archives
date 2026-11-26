-- Axes d'amélioration rangés dans l'ordre choisi par l'arbitre : une ligne par axe (texte et
-- position) au lieu d'une colonne par axe. Prépare aussi les catégories personnelles (une
-- ligne de plus par catégorie).
--  * default_key : l'axe par défaut de la ligne (son libellé est dans l'application).
--  * position : rang d'affichage, à partir de 0, unique par utilisateur. Contrainte différée :
--    un changement d'ordre réécrit toutes les positions dans la même transaction.
-- Un utilisateur n'a des lignes qu'à partir de son premier enregistrement ; avant, et pour
-- tout axe par défaut sans ligne, l'application affiche l'axe à la suite, texte vide.
-- Effet sur les données existantes : chaque fiche de `improvement_axes` devient 7 lignes,
-- dans l'ordre d'origine, avec les mêmes textes et dates ; l'ancienne table est supprimée.

-- Up Migration

CREATE TABLE improvement_axis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  default_key text NOT NULL,
  position smallint NOT NULL,
  body text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Liste alignée sur `IMPROVEMENT_AXES` (`src/lib/improvement-axes-fields.ts`).
  CONSTRAINT improvement_axis_default_key_check CHECK (default_key IN ('mechanicsAk',
    'mechanicsAt', 'mechanicsTransitions', 'decisionMaking', 'signals', 'foulJudgment',
    'violationJudgment')),
  CONSTRAINT improvement_axis_position_check CHECK (position >= 0),
  -- Texte vide = NULL (l'application l'assure) ; 4 096 caractères au plus, comme la note.
  CONSTRAINT improvement_axis_body_check
    CHECK (body IS NULL OR (body ~ '\S' AND char_length(body) <= 4096)),
  CONSTRAINT improvement_axis_user_default_key_key UNIQUE (user_id, default_key),
  CONSTRAINT improvement_axis_user_position_key UNIQUE (user_id, position)
    DEFERRABLE INITIALLY DEFERRED
);

CREATE TRIGGER improvement_axis_set_updated_at BEFORE UPDATE ON improvement_axis
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO improvement_axis (user_id, default_key, position, body, created_at, updated_at)
SELECT i.user_id, a.default_key, a.position, a.body, i.created_at, i.updated_at
FROM improvement_axes i
CROSS JOIN LATERAL (VALUES
  ('mechanicsAk', 0, i.mechanics_ak),
  ('mechanicsAt', 1, i.mechanics_at),
  ('mechanicsTransitions', 2, i.mechanics_transitions),
  ('decisionMaking', 3, i.decision_making),
  ('signals', 4, i.signals),
  ('foulJudgment', 5, i.foul_judgment),
  ('violationJudgment', 6, i.violation_judgment)
) AS a (default_key, position, body);

DROP TABLE improvement_axes;

-- Down Migration

-- L'ordre choisi est perdu : l'ancienne table n'a qu'un ordre fixe.
CREATE TABLE improvement_axes (
  user_id uuid PRIMARY KEY REFERENCES "user" (id) ON DELETE CASCADE,
  mechanics_ak text,
  mechanics_at text,
  mechanics_transitions text,
  decision_making text,
  signals text,
  foul_judgment text,
  violation_judgment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT improvement_axes_texts_check CHECK (
    (mechanics_ak IS NULL OR (mechanics_ak ~ '\S' AND char_length(mechanics_ak) <= 4096))
    AND (mechanics_at IS NULL OR (mechanics_at ~ '\S' AND char_length(mechanics_at) <= 4096))
    AND (mechanics_transitions IS NULL
      OR (mechanics_transitions ~ '\S' AND char_length(mechanics_transitions) <= 4096))
    AND (decision_making IS NULL
      OR (decision_making ~ '\S' AND char_length(decision_making) <= 4096))
    AND (signals IS NULL OR (signals ~ '\S' AND char_length(signals) <= 4096))
    AND (foul_judgment IS NULL OR (foul_judgment ~ '\S' AND char_length(foul_judgment) <= 4096))
    AND (violation_judgment IS NULL
      OR (violation_judgment ~ '\S' AND char_length(violation_judgment) <= 4096))
  )
);

CREATE TRIGGER improvement_axes_set_updated_at BEFORE UPDATE ON improvement_axes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO improvement_axes (user_id, mechanics_ak, mechanics_at, mechanics_transitions,
  decision_making, signals, foul_judgment, violation_judgment, created_at, updated_at)
SELECT user_id,
  max(body) FILTER (WHERE default_key = 'mechanicsAk'),
  max(body) FILTER (WHERE default_key = 'mechanicsAt'),
  max(body) FILTER (WHERE default_key = 'mechanicsTransitions'),
  max(body) FILTER (WHERE default_key = 'decisionMaking'),
  max(body) FILTER (WHERE default_key = 'signals'),
  max(body) FILTER (WHERE default_key = 'foulJudgment'),
  max(body) FILTER (WHERE default_key = 'violationJudgment'),
  min(created_at), max(updated_at)
FROM improvement_axis
GROUP BY user_id;

DROP TABLE improvement_axis;
