/**
 * Données des listes du formulaire d'indemnité (saisie et modification) : niveaux,
 * barèmes choisissables avec la présélection par niveau, clubs et adresses de l'utilisateur.
 */
import { listAddresses, listClubs } from "../db/clubs";
import type { AddressSummary, ClubSummary } from "../db/clubs";
import { listDivisions, listFrequentDivisionIds } from "../db/divisions";
import type { Division } from "../db/divisions";
import {
  findCommonScaleId,
  listLevelDefaults,
  listSelectableScaleRates,
  listSelectableScales,
} from "../db/scales";
import type { PreviewRate } from "../db/scales";
import type { Queryable } from "../db/users";
import { resolveDefaultScaleId } from "../scales/default-scale";

/** Nombre de niveaux « souvent arbitrés » proposés en tête de la liste. */
const FREQUENT_DIVISIONS_LIMIT = 5;

export type CompensationFormData = {
  divisions: readonly Division[];
  /** Niveaux les plus saisis sur 12 mois, du plus fréquent au moins fréquent (en tête de liste). */
  frequentDivisionIds: readonly string[];
  /** Barèmes choisissables : le commun en premier, puis ceux de l'utilisateur. */
  scales: readonly { id: string; name: string }[];
  /** Barème présélectionné pour chaque niveau (choix de l'utilisateur, sinon le commun). */
  defaultScaleByDivision: Readonly<Record<string, string>>;
  clubs: readonly ClubSummary[];
  addresses: readonly AddressSummary[];
  /** Lignes de chaque barème choisissable, pour l'aperçu du montant (bloc 10). */
  ratesByScale: Readonly<Record<string, readonly Omit<PreviewRate, "scaleId">[]>>;
};

export async function loadCompensationFormData(
  db: Queryable,
  userId: string,
): Promise<CompensationFormData> {
  const [
    divisions,
    frequentDivisionIds,
    scales,
    levelDefaults,
    commonScaleId,
    clubs,
    addresses,
    rates,
  ] = await Promise.all([
    listDivisions(db),
    listFrequentDivisionIds(db, userId, FREQUENT_DIVISIONS_LIMIT),
    listSelectableScales(db, userId),
    listLevelDefaults(db, userId),
    findCommonScaleId(db),
    listClubs(db, userId),
    listAddresses(db, userId),
    listSelectableScaleRates(db, userId),
  ]);

  // Barème présélectionné pour chaque niveau, calculé ici : le client ne reçoit que le résultat.
  const selectableScaleIds = new Set(scales.map((scale) => scale.id));
  const defaultScaleByDivision: Record<string, string> = {};
  for (const division of divisions) {
    defaultScaleByDivision[division.id] = resolveDefaultScaleId({
      divisionId: division.id,
      levelDefaults,
      commonScaleId,
      selectableScaleIds,
    });
  }

  const ratesByScale: Record<string, Omit<PreviewRate, "scaleId">[]> = {};
  for (const { scaleId, ...rate } of rates) {
    (ratesByScale[scaleId] ??= []).push(rate);
  }

  return {
    divisions,
    frequentDivisionIds,
    scales: scales.map((scale) => ({ id: scale.id, name: scale.name })),
    defaultScaleByDivision,
    clubs,
    addresses,
    ratesByScale,
  };
}
