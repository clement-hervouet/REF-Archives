-- Feature « Clubs » (post-déploiement, §15.4.1) : un club se crée depuis le formulaire
-- d'indemnité avec son nom et son code postal seulement ; le reste de l'adresse (rue,
-- numéro, ville, pays) se complète plus tard dans l'onglet « Clubs ».
--  * address.street et address.city deviennent facultatifs. Le code postal reste
--    obligatoire : il suffit à déduire l'organisme qui verse (CD ou ligue, bloc 10).
--  * Effet sur les données existantes : aucun. Toutes les adresses actuelles ont une rue
--    et une ville ; rien n'est réécrit.
--  * L'application n'enregistre jamais de chaîne vide (NULL à la place) : les CHECK le
--    garantissent aussi en base. Les lignes existantes les respectent déjà (Zod `min(1)`).

-- Up Migration

ALTER TABLE address
  ALTER COLUMN street DROP NOT NULL,
  ALTER COLUMN city DROP NOT NULL,
  ADD CONSTRAINT address_street_not_blank_check CHECK (street IS NULL OR btrim(street) <> ''),
  ADD CONSTRAINT address_city_not_blank_check CHECK (city IS NULL OR btrim(city) <> '');

-- Down Migration

-- Une adresse partielle ne peut pas revenir au modèle précédent sans inventer de valeur.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM address WHERE street IS NULL OR city IS NULL) THEN
    RAISE EXCEPTION '022_clubs-adresse-partielle (down) : des adresses sans rue ou sans ville existent';
  END IF;
END
$$;

ALTER TABLE address
  DROP CONSTRAINT address_city_not_blank_check,
  DROP CONSTRAINT address_street_not_blank_check,
  ALTER COLUMN city SET NOT NULL,
  ALTER COLUMN street SET NOT NULL;
