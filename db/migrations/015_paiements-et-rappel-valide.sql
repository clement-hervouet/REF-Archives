-- Bloc 10 (accueil) : paiement des indemnités et validation du rappel des indisponibilités.
--  * compensation.paid_on : jour (Paris) où l'indemnité a été payée, NULL tant qu'elle ne
--    l'est pas. Une date, pas un instant : c'est ce que l'arbitre saisit (« payée le 12/11 »).
--    L'application refuse une date future ; la base refuse une date absurde.
--  * Index partiel des indemnités non payées et actives : le résumé de l'accueil et la page
--    « À rembourser » ne lisent que celles-là.
--  * "user".availability_ack_week : lundi (Paris) de la semaine où l'utilisateur a indiqué
--    avoir saisi ses indisponibilités. Le rappel de l'accueil reste masqué toute cette
--    semaine et revient le lundi suivant, sans job ni remise à zéro.

-- Up Migration

ALTER TABLE compensation ADD COLUMN paid_on date;

ALTER TABLE compensation
  ADD CONSTRAINT compensation_paid_on_check CHECK (paid_on >= DATE '2000-01-01');

CREATE INDEX compensation_unpaid_idx ON compensation (user_id, starts_at)
  WHERE paid_on IS NULL AND deleted_at IS NULL;

ALTER TABLE "user" ADD COLUMN availability_ack_week date;

ALTER TABLE "user"
  ADD CONSTRAINT user_availability_ack_week_monday_check
    CHECK (EXTRACT(ISODOW FROM availability_ack_week) = 1);

-- Down Migration

ALTER TABLE "user" DROP CONSTRAINT user_availability_ack_week_monday_check;

ALTER TABLE "user" DROP COLUMN availability_ack_week;

DROP INDEX compensation_unpaid_idx;

ALTER TABLE compensation DROP CONSTRAINT compensation_paid_on_check;

ALTER TABLE compensation DROP COLUMN paid_on;
