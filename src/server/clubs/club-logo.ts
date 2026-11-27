/**
 * Logo d'un club pour l'affichage (pastille) : celui enregistré s'il correspond au logo
 * FFBB du club, sinon téléchargé une fois depuis le CDN de la FFBB puis enregistré. Un
 * échec est retenu `RETRY_AFTER_MS` pour ne pas réinterroger le CDN à chaque affichage ;
 * la pastille montre alors les initiales. Ni Next.js ni authentification ici (§6.2) :
 * l'utilisateur vient de la session ; il voit les logos de ses clubs et ceux des matchs
 * partagés avec lui (`findClubLogo`).
 */
import { findClubLogo, saveClubLogo } from "../db/club-logos";
import type { Queryable } from "../db/users";
import type { FetchLogo, LogoImage } from "../ffbb/ffbb-logos";

/** Un téléchargement raté est retenté au plus une fois par jour. */
export const RETRY_AFTER_MS = 24 * 60 * 60 * 1000;

export type ClubLogoDeps = { db: Queryable; fetchLogo: FetchLogo };

/** Logo d'un club visible par l'utilisateur, ou `null` (pas de logo, introuvable, échec). */
export async function getClubLogo(
  deps: ClubLogoDeps,
  input: { userId: string; clubId: string; now: Date },
): Promise<LogoImage | null> {
  const state = await findClubLogo(deps.db, input);
  if (state === null || state.logoUuid === null) {
    return null;
  }
  const { stored } = state;
  if (stored !== null && stored.logoUuid === state.logoUuid) {
    if (stored.image !== null) {
      return stored.image;
    }
    if (input.now.getTime() - stored.fetchedAt.getTime() < RETRY_AFTER_MS) {
      return null;
    }
  }
  const image = await deps.fetchLogo(state.logoUuid);
  await saveClubLogo(deps.db, {
    userId: state.ownerId,
    clubId: input.clubId,
    logoUuid: state.logoUuid,
    image,
    fetchedAt: input.now,
  });
  return image;
}
