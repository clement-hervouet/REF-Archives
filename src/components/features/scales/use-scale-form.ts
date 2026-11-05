/**
 * `useActionState` qui garde la saisie quand l'action échoue. React 19 réinitialise
 * un `<form action>` après chaque envoi, même en cas d'erreur : sans ce hook, une faute
 * de frappe ferait perdre tout le formulaire. Le formulaire est remonté (`key`) avec
 * les valeurs saisies en `defaultValue`, ou vidé après un succès. Il peut aussi partir de
 * valeurs existantes (modification).
 */
import { useActionState } from "react";

type Values = Readonly<Record<string, string>>;

type Wrapped<S> = { state: S; values: Values; version: number };

/** Garde uniquement les champs texte : un fichier n'a rien à faire dans ces formulaires. */
function textValues(formData: FormData): Values {
  const values: Record<string, string> = {};
  formData.forEach((value, name) => {
    if (typeof value === "string") {
      values[name] = value;
    }
  });
  return values;
}

export function useScaleForm<S extends { status: string }>(
  action: (previous: S, formData: FormData) => Promise<S>,
  initial: S,
  successStatuses: readonly string[],
  /** Valeurs affichées avant le premier envoi (formulaire de modification). */
  initialValues: Values = {},
) {
  const [wrapped, formAction, isPending] = useActionState(
    async (previous: Wrapped<S>, formData: FormData): Promise<Wrapped<S>> => {
      const state = await action(previous.state, formData);
      const succeeded = successStatuses.includes(state.status);
      return {
        state,
        values: succeeded ? {} : textValues(formData),
        version: previous.version + 1,
      };
    },
    { state: initial, values: initialValues, version: 0 },
  );
  return {
    state: wrapped.state,
    /** Valeur à remettre dans un champ après une erreur. */
    valueOf: (name: string): string => wrapped.values[name] ?? "",
    /** À passer en `key` du formulaire pour le remonter après chaque envoi. */
    formKey: wrapped.version,
    formAction,
    isPending,
  };
}
