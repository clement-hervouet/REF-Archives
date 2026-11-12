-- Bloc 16 (suite) : changement de mot de passe par un utilisateur connecté (écart ASVS V6).
-- Nouvel événement de sécurité, distinct du reset par lien (`password_reset_completed`) et de
-- l'envoi d'un lien par un admin (`account_password_reset_sent`).
--  * ALTER TYPE … ADD VALUE est accepté dans une transaction (PostgreSQL ≥ 12) tant que la
--    nouvelle valeur n'y est pas utilisée. IF NOT EXISTS rend la migration rejouable.

-- Up Migration

ALTER TYPE security_event_type ADD VALUE IF NOT EXISTS 'password_changed';

-- Down Migration

-- PostgreSQL ne sait pas retirer une valeur d'une énumération : elle reste (voir
-- 012_flux-ical.sql). Rien d'autre à défaire.
SELECT 1;
