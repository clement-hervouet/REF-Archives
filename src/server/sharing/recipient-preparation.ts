/**
 * Enregistrement de la préparation d'un match partagé, par le destinataire (migration 035).
 *
 * Même enregistrement champ par champ que le propriétaire (`preparation-values.ts`), sur
 * les seuls champs communs. Les cases « déjà arbitrée » du formulaire sont celles du
 * destinataire : elles vont sur son partage (`game_share`) et ne touchent jamais celles du
 * propriétaire. La préparation reste au propriétaire, même quand le destinataire l'écrit
 * en premier ; le destinataire est noté comme auteur (`updated_by`).
 */
import type { PreparationForm } from "@/lib/schemas/preparations";
import { seasonStartOf } from "@/lib/seasons";
import { findAlreadyRefereed } from "../db/preparations";
import {
  findRecipientPreparation,
  lockRecipientShare,
  saveRecipientChecks,
  saveRecipientPreparation as writeRecipientPreparation,
} from "../db/shared-preparations";
import type { RefereedChecks } from "../db/shared-preparations";
import type { SavePreparationResult } from "../games/manage-preparation";
import { mergePreparation, preparationValues } from "../games/preparation-values";
import type { SharingDeps } from "./manage-sharing";

/** Préparation avec les cases « déjà arbitrée » données. */
function withChecks(preparation: PreparationForm, checks: RefereedChecks): PreparationForm {
  return {
    ...preparation,
    team1: { ...preparation.team1, alreadyRefereed: checks.team1 },
    team2: { ...preparation.team2, alreadyRefereed: checks.team2 },
  };
}

/** Valeurs de formulaire du destinataire : la préparation, avec ses propres cases. */
export function recipientFormValues(
  preparation: PreparationForm,
  checks: RefereedChecks,
): Record<string, string> {
  return preparationValues(withChecks(preparation, checks));
}

/** Cases « déjà arbitrée » saisies dans le formulaire. */
function checksOf(preparation: PreparationForm): RefereedChecks {
  return { team1: preparation.team1.alreadyRefereed, team2: preparation.team2.alreadyRefereed };
}

/**
 * Écrit les champs modifiés de la préparation d'un match partagé avec `viewerId`, et ses
 * cases. `base` : valeurs de départ du formulaire.
 */
export async function saveSharedPreparation(
  deps: SharingDeps,
  viewerId: string,
  gameId: string,
  input: { preparation: PreparationForm; base: PreparationForm },
): Promise<SavePreparationResult> {
  return deps.transaction(async (db): Promise<SavePreparationResult> => {
    const share = await lockRecipientShare(db, { gameId, viewerId });
    if (share === null) {
      return { status: "not_found" };
    }
    const current = await findRecipientPreparation(db, { gameId, viewerId });
    let toWrite = input.preparation;
    // Préparation créée par le destinataire : les cases du propriétaire prennent son calcul
    // « déjà arbitrée », comme s'il l'avait créée (partage vérifié et verrouillé ci-dessus).
    let ownerChecks = { team1: false, team2: false };
    if (current === null) {
      ownerChecks =
        (await findAlreadyRefereed(db, {
          userId: share.ownerUserId,
          gameId,
          seasonFrom: seasonStartOf(share.startsAt),
        })) ?? ownerChecks;
    } else {
      // Les cases du propriétaire ne viennent pas de ce formulaire : on les fige des deux
      // côtés pour qu'elles ne soient jamais vues comme modifiées.
      const currentOwnerChecks = checksOf(current);
      const merged = mergePreparation({
        base: withChecks(input.base, currentOwnerChecks),
        mine: withChecks(input.preparation, currentOwnerChecks),
        current,
      });
      if (merged.status === "conflict") {
        // Valeurs de départ du nouvel essai : la préparation enregistrée, avec les cases du
        // destinataire (il est le seul à les écrire : jamais en conflit).
        return {
          status: "conflict",
          saved: recipientFormValues(current, share.checks),
          conflicts: merged.conflicts,
        };
      }
      toWrite = merged.preparation;
    }
    if (
      !(await writeRecipientPreparation(db, {
        gameId,
        viewerId,
        preparation: toWrite,
        ownerChecks,
      }))
    ) {
      return { status: "not_found" };
    }
    await saveRecipientChecks(db, { gameId, viewerId, checks: checksOf(input.preparation) });
    return { status: "saved" };
  });
}
