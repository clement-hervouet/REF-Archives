-- Récapitulatif des matchs de semaine (§15.4.9) : envoyé le lundi pour les matchs du lundi
-- au jeudi, en plus du récapitulatif du weekend. Nouveau type d'envoi dans
-- `reminder_dispatch` (un récapitulatif par semaine, clé = lundi de la semaine).
--  * Pas de nouveau réglage : la case « Récapitulatifs des matchs » (`weekend_recap_enabled`)
--    active les deux récapitulatifs.
-- Effet sur les données existantes : aucun (valeur ajoutée à l'énumération).

-- Up Migration

ALTER TYPE reminder_kind ADD VALUE IF NOT EXISTS 'weekday_recap';

-- Down Migration

-- PostgreSQL ne sait pas retirer une valeur d'énumération : rien à défaire (retour arrière
-- par restauration de la sauvegarde, §3.18).
