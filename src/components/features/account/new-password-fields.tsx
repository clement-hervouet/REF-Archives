"use client";

/**
 * Nouveau mot de passe et confirmation, avec vérification pendant la saisie : longueur,
 * mot de passe trop courant, confirmation identique. Partagé par la création du compte
 * (invitation), la réinitialisation et « Changer mon mot de passe ». Les règles viennent de
 * `src/lib/password-rules.ts` ; le serveur revalide tout à l'envoi.
 *
 * Les champs restent non contrôlés : React les vide lui-même après l'envoi d'un formulaire
 * à action. On écoute donc l'événement `reset` du formulaire pour remettre la liste à zéro.
 */
import { Check, Circle, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { fr } from "@/i18n/fr";
import { evaluatePasswordRules } from "@/lib/password-rules";
import type { PasswordRuleState } from "@/lib/password-rules";
import { PASSWORD_MAX_LENGTH } from "@/lib/schemas/auth";
import { cn } from "@/lib/utils";

const t = fr.passwordRules;

const ICONS: Record<PasswordRuleState, LucideIcon> = {
  empty: Circle,
  ok: Check,
  ko: X,
};

function RuleItem({ state, label, id }: { state: PasswordRuleState; label: string; id?: string }) {
  const Icon = ICONS[state];
  return (
    <li
      id={id}
      className={cn(
        "flex items-start gap-2 text-sm",
        state === "empty" ? "text-muted-foreground" : "text-foreground",
      )}
    >
      {/* L'état est donné par l'icône ET par le texte masqué (jamais la couleur seule). */}
      <Icon
        aria-hidden="true"
        strokeWidth={state === "empty" ? 1.75 : 2.5}
        className={cn(
          "mt-0.5 size-4 shrink-0",
          state === "empty" && "scale-75",
          state === "ok" && "text-success",
          state === "ko" && "text-destructive",
        )}
      />
      <span>
        {label}
        <span className="sr-only"> : {t.states[state]}</span>
      </span>
    </li>
  );
}

type Props = {
  /** Préfixe des `id` HTML (issu de `useId` ou fixe s'il n'y a qu'un formulaire). */
  idPrefix: string;
  /** Nom du champ du nouveau mot de passe dans le formulaire (`password`, `newPassword`). */
  name: string;
  passwordLabel: string;
  confirmationLabel: string;
  hint: string;
  /** `id` du message d'erreur du formulaire, relié aux deux champs quand il est affiché. */
  errorId?: string | undefined;
  passwordInvalid?: boolean | undefined;
  confirmationInvalid?: boolean | undefined;
  fieldClassName: string;
};

export function NewPasswordFields({
  idPrefix,
  name,
  passwordLabel,
  confirmationLabel,
  hint,
  errorId,
  passwordInvalid,
  confirmationInvalid,
  fieldClassName,
}: Props) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const passwordRef = useRef<HTMLInputElement>(null);
  const rules = evaluatePasswordRules(password, confirmation);

  useEffect(() => {
    const form = passwordRef.current?.form;
    if (form === null || form === undefined) {
      return;
    }
    function onReset() {
      setPassword("");
      setConfirmation("");
    }
    form.addEventListener("reset", onReset);
    return () => {
      form.removeEventListener("reset", onReset);
    };
  }, []);

  const passwordId = `${idPrefix}-password`;
  const confirmationId = `${idPrefix}-confirmation`;
  const hintId = `${idPrefix}-hint`;
  const rulesId = `${idPrefix}-rules`;
  const matchId = `${idPrefix}-match`;
  const join = (ids: (string | undefined)[]) =>
    ids.filter((value) => value !== undefined).join(" ") || undefined;

  return (
    <>
      <div className="flex flex-col gap-1">
        <label htmlFor={passwordId} className="text-sm font-medium">
          {passwordLabel}
        </label>
        <input
          ref={passwordRef}
          id={passwordId}
          name={name}
          type="password"
          autoComplete="new-password"
          required
          maxLength={PASSWORD_MAX_LENGTH}
          onChange={(event) => {
            setPassword(event.currentTarget.value);
          }}
          aria-invalid={passwordInvalid}
          aria-describedby={join([errorId, hintId, rulesId])}
          className={fieldClassName}
        />
        <p id={hintId} className="text-sm text-muted-foreground">
          {hint}
        </p>
        <ul id={rulesId} aria-label={t.label} className="flex flex-col gap-0.5">
          <RuleItem
            state={rules.length}
            label={t.length.replace("{count}", String(password.length))}
          />
          <RuleItem state={rules.notCommon} label={t.notCommon} />
        </ul>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={confirmationId} className="text-sm font-medium">
          {confirmationLabel}
        </label>
        <input
          id={confirmationId}
          name="confirmation"
          type="password"
          autoComplete="new-password"
          required
          maxLength={PASSWORD_MAX_LENGTH}
          onChange={(event) => {
            setConfirmation(event.currentTarget.value);
          }}
          aria-invalid={confirmationInvalid}
          aria-describedby={join([errorId, rules.match === "empty" ? undefined : matchId])}
          className={fieldClassName}
        />
        {rules.match !== "empty" && (
          <ul className="flex flex-col">
            <RuleItem
              id={matchId}
              state={rules.match}
              label={rules.match === "ok" ? t.match : t.mismatch}
            />
          </ul>
        )}
      </div>
    </>
  );
}
