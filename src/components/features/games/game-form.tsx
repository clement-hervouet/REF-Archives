"use client";

/**
 * Formulaire d'un match complet (bloc 9e) : création sans indemnité (informations et
 * officiels) ou modification des informations depuis la fiche. Les champs du match sont
 * ceux de l'indemnité (`MatchFields`, sans barème ni distance).
 */
import { MatchFields } from "@/components/features/compensations/compensation-form";
import { FormMessage, PRIMARY_BUTTON_CLASS } from "@/components/features/scales/form-parts";
import { useScaleForm } from "@/components/features/scales/use-scale-form";
import type { CompensationFormData } from "@/server/compensation/form-data";
import type { Colleague } from "@/server/db/persons";
import type { GameFormState } from "@/server/games/game-info-form";
import { gameFormStatusMessage, matchFieldsState, officialsFieldState } from "./game-messages";
import { OfficialsFieldset } from "./officials-form";

type Props = {
  action: (previous: GameFormState, formData: FormData) => Promise<GameFormState>;
  data: CompensationFormData;
  /** Valeurs de départ (relues après chaque modification réussie). */
  initialValues: Readonly<Record<string, string>>;
  labels: { submit: string; submitting: string };
} & (
  | { mode: "create"; colleagues: readonly Colleague[] }
  /** Modification : identifiant du match en champ caché, vérifié côté serveur. */
  | { mode: "edit"; gameId: string }
);

export function GameForm(props: Props) {
  const { action, data, initialValues, labels } = props;
  const { state, valueOf, formKey, formAction, isPending } = useScaleForm(
    action,
    { status: "idle" },
    // Création réussie : la Server Action redirige vers la fiche.
    ["updated"],
    initialValues,
  );
  // Après une modification réussie, on repart des valeurs renvoyées par la page (un club
  // créé à la volée y apparaît avec son identifiant, sans doublon au renvoi). Le champ
  // `date`, obligatoire et toujours envoyé, distingue « saisie conservée » de « rien ».
  const keptInput = valueOf("date") !== "";
  const current = (name: string): string =>
    keptInput ? valueOf(name) : (initialValues[name] ?? "");

  return (
    <div className="flex flex-col gap-4">
      <FormMessage message={gameFormStatusMessage(state)} />
      <form key={formKey} action={formAction} className="flex flex-col gap-6">
        {props.mode === "edit" && <input type="hidden" name="gameId" value={props.gameId} />}
        <MatchFields
          data={data}
          state={matchFieldsState(state)}
          valueOf={current}
          withCompensation={false}
        />
        {props.mode === "create" && (
          <OfficialsFieldset
            colleagues={props.colleagues}
            current={current}
            state={officialsFieldState(state)}
          />
        )}
        <button type="submit" disabled={isPending} className={`${PRIMARY_BUTTON_CLASS} self-start`}>
          {isPending ? labels.submitting : labels.submit}
        </button>
      </form>
    </div>
  );
}
