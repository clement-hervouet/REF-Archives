/**
 * Résolution des informations d'un match dans une transaction, commune à l'indemnité
 * (bloc 6) et au match complet (bloc 9) : clubs existants verrouillés ou créés à la volée
 * (nom et code postal, salles s'il vient de l'annuaire FFBB, §15.4.1), adresse du match
 * (salle principale du club de l'équipe 1, ou une autre, rattachée alors aux salles de ce
 * club), équipes retrouvées ou créées au niveau du match.
 *
 * Le niveau (division) et le tour de coupe ne sont pas vérifiés ici : chaque service les
 * vérifie avant toute écriture (`match-level.ts`), dans l'ordre qui lui convient. Un refus passe par `reject`, que le service
 * fournit pour annuler sa propre transaction.
 */
import type { MatchInfo } from "@/lib/schemas/compensations";
import { addressBelongsTo } from "../db/compensations";
import {
  attachClubVenue,
  ensureTeam,
  findOrInsertAddress,
  insertNewClub,
  lockOwnedClubs,
} from "../db/compensation-writes";
import type { LockedClub } from "../db/compensation-writes";
import type { CupRound } from "../db/divisions";
import type { Queryable } from "../db/users";

type MatchRejection =
  | { status: "not_found"; field: "team1" | "team2" | "venue" }
  | { status: "limit_reached"; resource: "club" };

type Reject = (rejection: MatchRejection) => never;

/** Identifiants des lignes que le match référence. */
export type ResolvedMatch = {
  startsAt: Date;
  divisionId: string;
  /** Tour de coupe déjà vérifié (§15.4.6), `null` hors coupe. */
  cupRound: CupRound | null;
  team1Id: string;
  /** `null` pour un plateau : club organisateur seul (§15.4.7). */
  team2Id: string | null;
  addressId: string;
};

type TeamSide = "team1" | "team2";

/** Club d'une équipe : celui choisi (verrouillé plus tôt) ou un nouveau, avec son adresse. */
async function resolveClub(
  db: Queryable,
  userId: string,
  choice: MatchInfo["team1"],
  side: TeamSide,
  lockedClubs: ReadonlyMap<string, LockedClub>,
  reject: Reject,
): Promise<LockedClub> {
  if (choice.kind === "existing") {
    return lockedClubs.get(choice.clubId) ?? reject({ status: "not_found", field: side });
  }
  // Nouveau club : code postal seul (le reste se complète dans « Clubs »), ou ses salles
  // s'il vient de l'annuaire FFBB.
  const club = await insertNewClub(db, { userId, club: choice });
  return club ?? reject({ status: "limit_reached", resource: "club" });
}

/** Adresse du match : la salle principale du club de l'équipe 1, ou une autre. */
async function resolveVenue(
  db: Queryable,
  userId: string,
  venue: MatchInfo["venue"],
  club1: LockedClub,
  reject: Reject,
): Promise<string> {
  switch (venue.kind) {
    case "team1":
      return club1.addressId;
    case "existing":
      return (await addressBelongsTo(db, { addressId: venue.addressId, userId }))
        ? venue.addressId
        : reject({ status: "not_found", field: "venue" });
    case "new":
      return findOrInsertAddress(db, { userId, address: venue.address });
  }
}

export async function resolveMatchInfo(
  db: Queryable,
  userId: string,
  info: MatchInfo,
  reject: Reject,
): Promise<ResolvedMatch> {
  const existingClubIds = [info.team1, info.team2].flatMap((team) =>
    team?.kind === "existing" ? [team.clubId] : [],
  );
  const lockedClubs = await lockOwnedClubs(db, { userId, clubIds: existingClubIds });
  const club1 = await resolveClub(db, userId, info.team1, "team1", lockedClubs, reject);
  const club2 =
    info.team2 === null
      ? null
      : await resolveClub(db, userId, info.team2, "team2", lockedClubs, reject);
  const addressId = await resolveVenue(db, userId, info.venue, club1, reject);
  // Le club de l'équipe 1 reçoit dans cette salle : elle rejoint ses salles, proposées
  // ensuite dans la liste « Salle » (rien si c'est déjà l'une d'elles).
  if (addressId !== club1.addressId) {
    await attachClubVenue(db, { userId, clubId: club1.id, addressId });
  }

  const team1Id = await ensureTeam(db, { userId, clubId: club1.id, divisionId: info.divisionId });
  const team2Id =
    club2 === null
      ? null
      : await ensureTeam(db, { userId, clubId: club2.id, divisionId: info.divisionId });

  return {
    startsAt: info.startsAt,
    divisionId: info.divisionId,
    cupRound: info.cupRound,
    team1Id,
    team2Id,
    addressId,
  };
}
