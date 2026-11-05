/**
 * Transforme les officiels validés (`officialsSchema`) en identifiants de personnes, dans
 * la transaction du match : fiche « moi » créée au premier besoin, collègues existants
 * vérifiés, nouveaux collègues créés à la volée.
 *
 * Un collègue « existant » doit appartenir à l'utilisateur et ne pas être sa fiche
 * « moi » : l'utilisateur ne peut occuper une place que par le choix « Moi », ce qui
 * garde la règle « exactement une place » vérifiable par le schéma.
 */
import { OFFICIAL_SLOTS } from "@/lib/schemas/officials";
import type { Officials } from "@/lib/schemas/officials";
import type { OfficialIds } from "../db/games";
import { ensureSelfPerson, findOwnedColleagueIds, insertColleague } from "../db/persons";
import type { Queryable } from "../db/users";
import { rejectGame } from "./rejection";

export async function resolveOfficials(
  db: Queryable,
  userId: string,
  officials: Officials,
): Promise<OfficialIds> {
  const existingIds = OFFICIAL_SLOTS.flatMap((slot) => {
    const choice = officials[slot];
    return choice.kind === "existing" ? [choice.personId] : [];
  });
  const owned = await findOwnedColleagueIds(db, { userId, personIds: existingIds });

  const resolved: OfficialIds = { referee1: null, referee2: null, referee3: null, observer: null };
  for (const slot of OFFICIAL_SLOTS) {
    const choice = officials[slot];
    switch (choice.kind) {
      case "none":
        break;
      case "self":
        resolved[slot] = await ensureSelfPerson(db, userId);
        break;
      case "existing":
        resolved[slot] = owned.has(choice.personId)
          ? choice.personId
          : rejectGame({ status: "not_found", field: slot });
        break;
      case "new":
        resolved[slot] =
          (await insertColleague(db, { userId, colleague: choice.colleague })) ??
          rejectGame({ status: "limit_reached", resource: "colleague" });
        break;
    }
  }
  return resolved;
}
