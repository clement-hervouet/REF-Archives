-- Axes d'amélioration : ce que l'arbitre veut travailler, indépendamment de tout match, de
-- toute note et de toute préparation. Une seule fiche par utilisateur, un texte libre par
-- axe :
--  * mécanique AK, mécanique AT, mécanique des transitions ;
--  * prise de décision ;
--  * gestuelle ;
--  * jugement des fautes, jugement des violations.
-- Tous les textes sont facultatifs : vider un champ l'efface. Pas de soft delete : la fiche
-- est réécrite à chaque enregistrement et part avec le compte (CASCADE).
-- Effet sur les données existantes : aucun (nouvelle table).

-- Up Migration

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
  -- Texte vide = NULL (l'application l'assure) ; 4 096 caractères au plus, comme la note.
  -- Bornes alignées sur `src/lib/improvement-axes-fields.ts`.
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

-- Down Migration

DROP TABLE improvement_axes;
