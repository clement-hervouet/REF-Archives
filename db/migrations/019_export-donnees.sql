-- Bloc 11 : export de ses données par l'utilisateur (RGPD, §6.5).
-- L'export lui-même ne stocke rien : il est construit à la demande (src/server/db/data-export.ts).
-- Seul le journal de sécurité gagne une valeur, car un export complet est une action sensible
-- (une session volée pourrait s'en servir pour tout récupérer d'un coup).
--  * ALTER TYPE … ADD VALUE est accepté dans une transaction (PostgreSQL ≥ 12) tant que la
--    nouvelle valeur n'y est pas utilisée. IF NOT EXISTS rend la migration rejouable.

-- Up Migration

ALTER TYPE security_event_type ADD VALUE IF NOT EXISTS 'data_exported';

-- Down Migration

-- PostgreSQL ne sait pas retirer une valeur d'une énumération : elle reste (voir
-- 012_flux-ical.sql). Rien d'autre à défaire.
SELECT 1;
