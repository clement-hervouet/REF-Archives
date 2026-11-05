/**
 * Résolution des informations d'un match dans une transaction, commune à l'indemnité
 * (bloc 6) et au match complet (bloc 9) : clubs existants verrouillés ou créés à la volée,
 * adresse du match (celle du club de l'équipe 1 sauf exception), équipes retrouvées ou
 * créées au niveau du match.
 *
 * Le niveau (division) n'est pas vérifié ici : chaque service le vérifie avant toute
 * écriture, dans l'ordre qui lui convient. Un refus passe par `reject`, que le service
 * fournit pour annuler sa propre transaction.
 */
import type { MatchInfo } from "@/lib/schemas/compensations";
import {
  addressBelongsTo,
  ensureTeam,
  insertAddress,
  insertClub,
  lockOwnedClubs,
} from "../db/compensations";
import type { LockedClub } from "../db/compensations";
import type { Queryable } from "../db/users";

export type MatchRejection =
  | { status: "not_found"; field: "team1" | "team2" | "venue" }
  | { status: "limit_reached"; resource: "club" };

type Reject = (rejection: MatchRejection) => never;

/** Identifiants des lignes que le match référence. */
export type ResolvedMatch = {
  startsAt: Date;
  divisionId: string;
  team1Id: string;
  team2Id: string;
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
  const addressId = await insertAddress(db, { userId, address: choice.address });
  const clubId = await insertClub(db, { userId, name: choice.name, addressId });
  return clubId === null
    ? reject({ status: "limit_reached", resource: "club" })
    : { id: clubId, addressId };
}

/** Adresse du match : celle du club de l'équipe 1, sauf exception. */
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
      return insertAddress(db, { userId, address: venue.address });
  }
}

export async function resolveMatchInfo(
  db: Queryable,
  userId: string,
  info: MatchInfo,
  reject: Reject,
): Promise<ResolvedMatch> {
  const existingClubIds = [info.team1, info.team2].flatMap((team) =>
    team.kind === "existing" ? [team.clubId] : [],
  );
  const lockedClubs = await lockOwnedClubs(db, { userId, clubIds: existingClubIds });
  const club1 = await resolveClub(db, userId, info.team1, "team1", lockedClubs, reject);
  const club2 = await resolveClub(db, userId, info.team2, "team2", lockedClubs, reject);
  const addressId = await resolveVenue(db, userId, info.venue, club1, reject);

  const team1Id = await ensureTeam(db, { userId, clubId: club1.id, divisionId: info.divisionId });
  const team2Id = await ensureTeam(db, { userId, clubId: club2.id, divisionId: info.divisionId });

  return { startsAt: info.startsAt, divisionId: info.divisionId, team1Id, team2Id, addressId };
}
