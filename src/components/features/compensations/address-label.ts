/**
 * Libellé court d'une adresse, ex. « 2 Avenue du Sport, 62400 Béthune ».
 */
import type { AddressSummary } from "@/server/db/clubs";

export function addressLabel(
  address: Pick<AddressSummary, "street" | "number" | "postalCode" | "city">,
): string {
  const street = address.number === null ? address.street : `${address.number} ${address.street}`;
  return `${street}, ${address.postalCode} ${address.city}`;
}
