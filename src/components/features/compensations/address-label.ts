/**
 * Libellé court d'une adresse, ex. « 2 Avenue du Sport, 62400 Béthune ». Une adresse de
 * club peut être partielle (§15.4.1) : seules les parties connues sont affichées
 * (« 62400 » si seul le code postal est renseigné).
 */
import type { AddressSummary } from "@/server/db/clubs";

type AddressParts = Pick<AddressSummary, "street" | "number" | "postalCode" | "city">;

export function addressLabel(address: AddressParts): string {
  const street =
    address.street === null
      ? null
      : address.number === null
        ? address.street
        : `${address.number} ${address.street}`;
  const locality =
    address.city === null ? address.postalCode : `${address.postalCode} ${address.city}`;
  return street === null ? locality : `${street}, ${locality}`;
}

/**
 * Vrai si l'adresse suffit pour un itinéraire : rue, code postal et ville connus (le
 * numéro et le pays restent facultatifs).
 */
export function isCompleteAddress(address: Pick<AddressSummary, "street" | "city">): boolean {
  return address.street !== null && address.city !== null;
}

/**
 * Lieu court d'un club dans une liste, pour distinguer deux clubs du même nom : la ville,
 * sinon le code postal.
 */
export function clubPlace(address: Pick<AddressSummary, "postalCode" | "city">): string {
  return address.city ?? address.postalCode;
}
