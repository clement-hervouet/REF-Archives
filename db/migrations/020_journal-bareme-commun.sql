-- Bloc 16 (audit, F6) : journaliser les écritures du barème commun.
-- Le barème commun est modifiable uniquement par un admin (§3.7) et s'applique à tous les
-- comptes ; ses modifications doivent laisser une trace dans le journal de sécurité, au même
-- titre que les actions d'admin sur un compte. On ajoute trois valeurs à l'énumération.
--  * ALTER TYPE … ADD VALUE est accepté dans une transaction (PostgreSQL ≥ 12) tant que la
--    nouvelle valeur n'y est pas utilisée. IF NOT EXISTS rend la migration rejouable.

-- Up Migration

ALTER TYPE security_event_type ADD VALUE IF NOT EXISTS 'common_scale_rate_added';
ALTER TYPE security_event_type ADD VALUE IF NOT EXISTS 'common_scale_renamed';
ALTER TYPE security_event_type ADD VALUE IF NOT EXISTS 'common_scale_rate_deleted';

-- Down Migration

-- PostgreSQL ne sait pas retirer une valeur d'une énumération : elle reste (voir
-- 012_flux-ical.sql). Rien d'autre à défaire.
SELECT 1;
