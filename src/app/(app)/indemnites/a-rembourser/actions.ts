"use server";

/**
 * Server Action de la page « À rembourser » : note le paiement d'une sélection
 * d'indemnités. La session est vérifiée en base (§6.2) ; seules les indemnités de
 * l'utilisateur connecté sont modifiées (filtre dans la requête), et la date de référence
 * (« pas dans le futur ») est le jour de Paris côté serveur.
 */
import { revalidatePath } from "next/cache";
import { toParisIsoDate } from "@/lib/dates";
import { requireUser } from "@/server/auth/session";
import { handleMarkPaid } from "@/server/compensation/payments";
import type { MarkPaidState } from "@/server/compensation/payments";
import { markCompensationsPaid } from "@/server/db/payments";
import { getDb } from "@/server/db/pool";

export async function markPaidAction(
  _previous: MarkPaidState,
  formData: FormData,
): Promise<MarkPaidState> {
  const user = await requireUser();
  const db = getDb();
  const state = await handleMarkPaid(
    { markPaid: (input) => markCompensationsPaid(db, input) },
    user.id,
    formData,
    toParisIsoDate(new Date()),
  );
  // La page, la liste mensuelle (« Payée le… ») et le résumé de l'accueil changent.
  revalidatePath("/", "layout");
  return state;
}
