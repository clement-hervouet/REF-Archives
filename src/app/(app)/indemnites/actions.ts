"use server";

/**
 * Server Actions de la liste des indemnités : suppression (soft delete) et annulation d'un
 * paiement (bloc 10). La session est vérifiée en base (§6.2) et l'indemnité doit
 * appartenir à l'utilisateur connecté.
 */
import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth/session";
import { createCompensationDeps } from "@/server/compensation/compensation-deps";
import { handleDeleteCompensation } from "@/server/compensation/compensation-form";
import type { DeleteCompensationState } from "@/server/compensation/compensation-form";
import { handleClearPayment } from "@/server/compensation/payments";
import type { ClearPaymentState } from "@/server/compensation/payments";
import { clearCompensationPayment } from "@/server/db/payments";
import { getDb } from "@/server/db/pool";

export async function deleteCompensationAction(
  _previous: DeleteCompensationState,
  formData: FormData,
): Promise<DeleteCompensationState> {
  const user = await requireUser();
  const state = await handleDeleteCompensation(createCompensationDeps(), user.id, formData);
  revalidatePath("/indemnites", "layout");
  return state;
}

export async function clearPaymentAction(
  _previous: ClearPaymentState,
  formData: FormData,
): Promise<ClearPaymentState> {
  const user = await requireUser();
  const db = getDb();
  const state = await handleClearPayment(
    { clearPayment: (input) => clearCompensationPayment(db, input) },
    user.id,
    formData,
  );
  // La liste, la page « À rembourser » et le résumé de l'accueil changent.
  revalidatePath("/", "layout");
  return state;
}
