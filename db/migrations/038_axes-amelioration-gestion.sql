-- Axes d'amélioration : un huitième axe par défaut, « Gestion » (`management`), et les axes
-- par défaut deviennent supprimables.
--  * Supprimer un axe par défaut le masque (`hidden`) et efface son texte : la ligne reste,
--    pour que l'application ne le rajoute pas à la suite comme un axe jamais enregistré, et
--    pour pouvoir le rétablir (texte vide). Les catégories personnelles, elles, sont
--    vraiment supprimées.
--  * Seul un axe par défaut peut être masqué, et un axe masqué n'a pas de texte.
-- Liste alignée sur `IMPROVEMENT_AXES` (`src/lib/improvement-axes-fields.ts`).
-- Effet sur les données existantes : aucun ; « Gestion » s'affiche en fin de liste pour
-- chacun, texte vide, jusqu'au prochain enregistrement qui lui crée sa ligne.

-- Up Migration

ALTER TABLE improvement_axis
  DROP CONSTRAINT improvement_axis_default_key_check,
  ADD CONSTRAINT improvement_axis_default_key_check CHECK (default_key IN ('mechanicsAk',
    'mechanicsAt', 'mechanicsTransitions', 'decisionMaking', 'signals', 'foulJudgment',
    'violationJudgment', 'management')),
  ADD COLUMN hidden boolean NOT NULL DEFAULT false,
  ADD CONSTRAINT improvement_axis_hidden_check
    CHECK (NOT hidden OR (default_key IS NOT NULL AND body IS NULL));

-- Down Migration

-- L'axe « Gestion » et son texte sont perdus ; les axes masqués réapparaissent, texte vide.
DELETE FROM improvement_axis WHERE default_key = 'management';

ALTER TABLE improvement_axis
  DROP CONSTRAINT improvement_axis_hidden_check,
  DROP COLUMN hidden,
  DROP CONSTRAINT improvement_axis_default_key_check,
  ADD CONSTRAINT improvement_axis_default_key_check CHECK (default_key IN ('mechanicsAk',
    'mechanicsAt', 'mechanicsTransitions', 'decisionMaking', 'signals', 'foulJudgment',
    'violationJudgment'));
