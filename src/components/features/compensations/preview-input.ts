/**
 * Lecture des champs du formulaire d'indemnité pour le récapitulatif en direct (bloc 10).
 * Pur : prend une fonction de lecture (`FormData.get` ou valeurs de départ), aucun DOM ici.
 * Mêmes règles que le serveur : adresse du club de l'équipe 1 sauf exception cochée.
 */
import { NEW_CHOICE } from "@/lib/compensation-form-fields";
import type { CompensationFormData } from "@/server/compensation/form-data";
import type { PreviewInput } from "@/server/compensation/preview";

export type FormPreview = PreviewInput & {
  /** Noms des équipes (club existant ou nouveau), `null` tant qu'ils manquent. */
  team1Name: string | null;
  team2Name: string | null;
  /** Barème choisi, pour l'afficher. */
  scaleName: string | null;
};

type Read = (name: string) => string;

function teamName(
  read: Read,
  prefix: "team1" | "team2",
  data: CompensationFormData,
): string | null {
  const club = read(`${prefix}Club`);
  if (club === NEW_CHOICE) {
    const name = read(`${prefix}Name`).trim();
    return name === "" ? null : name;
  }
  return data.clubs.find((candidate) => candidate.id === club)?.name ?? null;
}

/** Code postal et pays saisis pour une nouvelle adresse (préfixe `team1` ou `venue`). */
function typedAddress(read: Read, prefix: "team1" | "venue"): PreviewInput["venue"] {
  const postalCode = read(`${prefix}PostalCode`).trim();
  if (postalCode === "") {
    return null;
  }
  const country = read(`${prefix}Country`).trim();
  return { postalCode, country: country === "" ? null : country };
}

function venue(read: Read, data: CompensationFormData): PreviewInput["venue"] {
  if (read("venueException") === "on") {
    const address = read("venueAddress");
    if (address === NEW_CHOICE) {
      return typedAddress(read, "venue");
    }
    const known = data.addresses.find((candidate) => candidate.id === address);
    return known === undefined ? null : { postalCode: known.postalCode, country: known.country };
  }
  // Cas normal : l'adresse du club de l'équipe 1, existant ou nouveau.
  const club = read("team1Club");
  if (club === NEW_CHOICE) {
    return typedAddress(read, "team1");
  }
  const known = data.clubs.find((candidate) => candidate.id === club);
  return known === undefined
    ? null
    : { postalCode: known.address.postalCode, country: known.address.country };
}

export function previewInputFromForm(read: Read, data: CompensationFormData): FormPreview {
  const scaleId = read("scaleId");
  const division = data.divisions.find((candidate) => candidate.id === read("divisionId"));
  return {
    date: read("date"),
    time: read("time"),
    category: division?.category ?? null,
    rates: data.ratesByScale[scaleId] ?? [],
    oneWayDistance: read("oneWayDistance"),
    payerChoice: read("payer"),
    venue: venue(read, data),
    team1Name: teamName(read, "team1", data),
    team2Name: teamName(read, "team2", data),
    scaleName: data.scales.find((scale) => scale.id === scaleId)?.name ?? null,
  };
}

/** Lecteur sur un `FormData` : un champ absent ou un fichier vaut une chaîne vide. */
export function readFormData(formData: FormData): Read {
  return (name) => {
    const value = formData.get(name);
    return typeof value === "string" ? value : "";
  };
}
