/**
 * Messages du formulaire « Supprimer mon compte » (bloc 11). Purs et sans React.
 */
import type { ScaleMessage } from "@/components/features/scales/scale-messages";
import { fr } from "@/i18n/fr";
import type { AccountDeletionState } from "@/app/(app)/parametres/account-deletion-actions";

const t = fr.myData.deletion.errors;

/** Message après l'envoi du formulaire, ou `null`. Le succès redirige : pas de message. */
export function accountDeletionMessage(state: AccountDeletionState): ScaleMessage | null {
  switch (state.status) {
    case "idle":
      return null;
    case "invalid":
      return { tone: "error", text: t.invalid };
    case "wrong_password":
      return { tone: "error", text: t.wrongPassword };
    case "rate_limited":
      return {
        tone: "error",
        text: t.rateLimited.replace("{minutes}", String(state.retryAfterMinutes)),
      };
    case "last_admin":
      return { tone: "error", text: t.lastAdmin };
    case "not_found":
      return { tone: "error", text: t.notFound };
  }
}
