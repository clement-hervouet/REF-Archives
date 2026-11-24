"use server";

/**
 * Recherche d'un club dans l'annuaire FFBB, à la saisie d'un club (page « Clubs », nouveau
 * club d'une indemnité, d'un match ou d'un collègue). Réservé aux utilisateurs connectés :
 * le serveur ne sert pas de relais ouvert vers l'API. Les arguments viennent du navigateur
 * et sont validés ici.
 */
import { z } from "zod";
import { requireUser } from "@/server/auth/session";
import { createFfbbFetch, getFfbbClub, searchFfbbClubs } from "@/server/ffbb/ffbb-clubs";
import type { FfbbClubDetails, FfbbClubHit, FfbbResult } from "@/server/ffbb/ffbb-clubs";

const citySchema = z.string().trim().min(2).max(100);
const ffbbIdSchema = z.string().regex(/^\d{1,20}$/);

/** Clubs domiciliés dans la ville saisie. */
export async function searchFfbbClubsAction(city: unknown): Promise<FfbbResult<FfbbClubHit[]>> {
  await requireUser();
  const parsed = citySchema.safeParse(city);
  if (!parsed.success) {
    return { ok: true, value: [] };
  }
  return searchFfbbClubs(createFfbbFetch(), parsed.data);
}

/** Nom et adresse (salle principale) du club choisi dans la liste. */
export async function getFfbbClubAction(id: unknown): Promise<FfbbResult<FfbbClubDetails>> {
  await requireUser();
  const parsed = ffbbIdSchema.safeParse(id);
  if (!parsed.success) {
    return { ok: false };
  }
  return getFfbbClub(createFfbbFetch(), parsed.data);
}
