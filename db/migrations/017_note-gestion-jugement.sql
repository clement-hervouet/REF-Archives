-- Bloc 10 : deux nouvelles échelles de la note de match, la gestion du match et le
-- jugement, de 1 à 5 comme la confiance et le stress (migration 013). NULL = non
-- renseigné ; les notes existantes restent valides.

-- Up Migration

ALTER TABLE note
  ADD COLUMN management smallint,
  ADD COLUMN judgment smallint;

ALTER TABLE note
  ADD CONSTRAINT note_management_range_check CHECK (management BETWEEN 1 AND 5),
  ADD CONSTRAINT note_judgment_range_check CHECK (judgment BETWEEN 1 AND 5);

-- Down Migration

ALTER TABLE note
  DROP CONSTRAINT note_judgment_range_check,
  DROP CONSTRAINT note_management_range_check;

ALTER TABLE note
  DROP COLUMN judgment,
  DROP COLUMN management;
