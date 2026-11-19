"use client";

/**
 * « Préparer le match » dans le menu d'une indemnité sans match complet (§15.4.10) : le
 * serveur crée le match (l'utilisateur arbitre 1, comme « Compléter le match ») puis ouvre
 * sa préparation. Jamais affiché pour un plateau. Le serveur vérifie la propriété (§6.2).
 */
import { useActionState } from "react";
import { MENU_ITEM_CLASS } from "@/components/features/compensations/menu-styles";
import { fr } from "@/i18n/fr";
import type { PrepareMatchState } from "@/server/games/preparation-form";

const t = fr.preparations;

type Props = {
  compensationId: string;
  dateLabel: string;
  action: (previous: PrepareMatchState, formData: FormData) => Promise<PrepareMatchState>;
};

export function PrepareMatchItem({ compensationId, dateLabel, action }: Props) {
  const [state, formAction, isPending] = useActionState<PrepareMatchState, FormData>(action, {
    status: "idle",
  });
  return (
    <form action={formAction}>
      <input type="hidden" name="compensationId" value={compensationId} />
      {state.status !== "idle" && (
        <p role="alert" className="px-3 py-1 text-sm font-medium text-destructive">
          {t.prepareErrors[state.status]}
        </p>
      )}
      <button
        type="submit"
        disabled={isPending}
        aria-label={t.prepareLabel.replace("{date}", dateLabel)}
        className={MENU_ITEM_CLASS}
      >
        {t.prepare}
      </button>
    </form>
  );
}
