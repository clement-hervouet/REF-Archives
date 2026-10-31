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

-- Montants FICTIFS (en centimes).
INSERT INTO scale (id, user_id, division_id, effective_from, game_amount_cents) VALUES
  (
    '00000000-0000-4000-8000-0000000000e1',
    '00000000-0000-4000-8000-000000000001',
    (SELECT id FROM division WHERE division = 'Departemental' AND type = 'Masculin' AND level = '1'),
    '2026-01-01',
    3000
  ),
  (
    '00000000-0000-4000-8000-0000000000e2',
    '00000000-0000-4000-8000-000000000001',
    (SELECT id FROM division WHERE division = 'Regional' AND type = 'Masculin' AND level = '1'),
    '2026-01-01',
    4500
  )
ON CONFLICT DO NOTHING;

INSERT INTO mileage_rate (id, user_id, effective_from, cents_per_km) VALUES
  ('00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-000000000001', '2026-01-01', 40.00)
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

INSERT INTO compensation (id, user_id, game_id, scale_id, mileage_rate_id, distance_m) VALUES
  (
    '00000000-0000-4000-8000-000000000093',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000091',
    '00000000-0000-4000-8000-0000000000e2',
    '00000000-0000-4000-8000-0000000000f1',
    46000
  )
ON CONFLICT DO NOTHING;

INSERT INTO note (id, user_id, game_id, body) VALUES
  ('00000000-0000-4000-8000-000000000092', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000091', 'Match fictif de développement.')
ON CONFLICT DO NOTHING;