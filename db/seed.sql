-- Données de DÉVELOPPEMENT uniquement (jamais en production). Montants du barème fictifs :
-- les vrais montants sont saisis au bloc 5. Idempotent : peut être relancé sans erreur.

-- Le hash n'est pas un hash argon2id valide : ce compte ne peut pas se connecter.
-- Le bloc 3 (comptes) fournira un vrai moyen de créer un utilisateur de dev.
INSERT INTO "user" (id, email, password_hash) VALUES
  ('00000000-0000-4000-8000-000000000001', 'dev@example.test', '!seed-connexion-impossible')
ON CONFLICT DO NOTHING;

INSERT INTO address (id, user_id, postal_code, city, street, number, country) VALUES
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000001', '75001', 'Paris', 'Rue de Rivoli', '1', 'FR'),
  ('00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-000000000001', '59000', 'Lille', 'Rue Nationale', '10', 'FR'),
  ('00000000-0000-4000-8000-0000000000a3', '00000000-0000-4000-8000-000000000001', '62000', 'Arras', 'Rue Gambetta', '5', 'FR'),
  ('00000000-0000-4000-8000-0000000000a4', '00000000-0000-4000-8000-000000000001', '62400', 'Béthune', 'Avenue du Sport', '2', 'FR')
ON CONFLICT DO NOTHING;

INSERT INTO person (id, user_id, type, is_self, firstname, lastname, licence, address_id) VALUES
  ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-000000000001', 'referee', true, 'Dev', 'Arbitre', 'DEV-0001', '00000000-0000-4000-8000-0000000000a1'),
  ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-000000000001', 'referee', false, 'Alex', 'Martin', 'DEV-0002', NULL)
ON CONFLICT DO NOTHING;

INSERT INTO club (id, user_id, address_id, name, licence) VALUES
  ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000a2', 'Club Alpha', 'CLUB-A'),
  ('00000000-0000-4000-8000-0000000000c2', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000a3', 'Club Beta', 'CLUB-B')
ON CONFLICT DO NOTHING;

INSERT INTO team (id, user_id, club_id, division_id) VALUES
  (
    '00000000-0000-4000-8000-0000000000d1',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-0000000000c1',
    (SELECT id FROM division WHERE division = 'Regional' AND type = 'Masculin' AND level = '1')
  ),
  (
    '00000000-0000-4000-8000-0000000000d2',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-0000000000c2',
    (SELECT id FROM division WHERE division = 'Regional' AND type = 'Masculin' AND level = '1')
  )
ON CONFLICT DO NOTHING;

-- Barèmes : montants FICTIFS (en centimes). Le barème commun est créé par la migration 009.
INSERT INTO scale_rate (id, scale_id, effective_from, game_amount_cents, cents_per_km) VALUES
  ('00000000-0000-4000-8000-0000000000e1', (SELECT id FROM scale WHERE user_id IS NULL), '2026-01-01', 3000, 40.00)
ON CONFLICT DO NOTHING;

INSERT INTO scale (id, user_id, name) VALUES
  ('00000000-0000-4000-8000-0000000000e2', '00000000-0000-4000-8000-000000000001', 'Comité fictif')
ON CONFLICT DO NOTHING;

INSERT INTO scale_rate (id, scale_id, effective_from, game_amount_cents, cents_per_km) VALUES
  ('00000000-0000-4000-8000-0000000000e3', '00000000-0000-4000-8000-0000000000e2', '2026-01-01', 4500, 40.00),
  ('00000000-0000-4000-8000-0000000000e4', '00000000-0000-4000-8000-0000000000e2', '2026-09-01', 4800, 42.50)
ON CONFLICT DO NOTHING;

-- Le Régional Masculin 1 utilise « Comité fictif » par défaut ; les autres niveaux, le barème commun.
INSERT INTO level_default_scale (user_id, division_id, scale_id) VALUES
  (
    '00000000-0000-4000-8000-000000000001',
    (SELECT id FROM division WHERE division = 'Regional' AND type = 'Masculin' AND level = '1'),
    '00000000-0000-4000-8000-0000000000e2'
  )
ON CONFLICT DO NOTHING;

INSERT INTO game (id, user_id, starts_at, division_id, address_id, team1_id, team2_id, referee1_id, referee2_id) VALUES
  (
    '00000000-0000-4000-8000-000000000091',
    '00000000-0000-4000-8000-000000000001',
    '2026-11-14 18:00:00+00',
    (SELECT id FROM division WHERE division = 'Regional' AND type = 'Masculin' AND level = '1'),
    '00000000-0000-4000-8000-0000000000a4',
    '00000000-0000-4000-8000-0000000000d1',
    '00000000-0000-4000-8000-0000000000d2',
    '00000000-0000-4000-8000-0000000000b1',
    '00000000-0000-4000-8000-0000000000b2'
  )
ON CONFLICT DO NOTHING;

-- Indemnités : chacune porte ses informations de match (bloc 6).
--  * 14/11/2026, liée au match fictif : la ligne en vigueur de « Comité fictif » est celle
--    du 01/09/2026.
--  * 10/10/2026, autonome (sans match), au barème commun, adresse du club de l'équipe 1.
INSERT INTO compensation (
  id, user_id, game_id, scale_rate_id, distance_m,
  starts_at, division_id, team1_id, team2_id, address_id
) VALUES
  (
    '00000000-0000-4000-8000-000000000093',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000091',
    '00000000-0000-4000-8000-0000000000e4',
    46000,
    '2026-11-14 18:00:00+00',
    (SELECT id FROM division WHERE division = 'Regional' AND type = 'Masculin' AND level = '1'),
    '00000000-0000-4000-8000-0000000000d1',
    '00000000-0000-4000-8000-0000000000d2',
    '00000000-0000-4000-8000-0000000000a4'
  ),
  (
    '00000000-0000-4000-8000-000000000094',
    '00000000-0000-4000-8000-000000000001',
    NULL,
    '00000000-0000-4000-8000-0000000000e1',
    24000,
    '2026-10-10 18:30:00+00',
    (SELECT id FROM division WHERE division = 'Regional' AND type = 'Masculin' AND level = '1'),
    '00000000-0000-4000-8000-0000000000d2',
    '00000000-0000-4000-8000-0000000000d1',
    '00000000-0000-4000-8000-0000000000a3'
  )
ON CONFLICT DO NOTHING;

INSERT INTO note (id, user_id, game_id, body) VALUES
  ('00000000-0000-4000-8000-000000000092', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000091', 'Match fictif de développement.')
ON CONFLICT DO NOTHING;