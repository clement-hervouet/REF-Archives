"use client";

/**
 * Liste « Organisme qui verse l'indemnité » (bloc 10). « Automatique » (valeur vide) laisse
 * la déduction se faire selon le niveau et l'adresse ; sinon Fédération, une ligue ou un
 * comité. Non contrôlée : le formulaire est remonté avec sa valeur après une erreur.
 */
import { useId } from "react";
import { FIELD_CLASS } from "@/components/features/scales/form-parts";
import { fr } from "@/i18n/fr";
import { DEPARTMENTS, LEAGUES, payerKey } from "@/lib/payers";

const t = fr.compensations.fields;

type Props = {
  id: string;
  defaultValue: string;
  error: string | null;
};

export function PayerSelect({ id, defaultValue, error }: Props) {
  const hintId = `${useId()}-payer-hint`;
  const errorId = `${hintId}-error`;
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {t.payer}
      </label>
      <select
        id={id}
        name="payer"
        defaultValue={defaultValue}
        aria-invalid={error !== null}
        aria-describedby={error === null ? hintId : `${hintId} ${errorId}`}
        className={FIELD_CLASS}
      >
        <option value="">{t.payerAuto}</option>
        <option value={payerKey({ kind: "federation" })}>{t.payerFederation}</option>
        <optgroup label={t.payerLeagues}>
          {LEAGUES.map((league) => (
            <option key={league.key} value={payerKey({ kind: "league", league: league.key })}>
              {league.name}
            </option>
          ))}
        </optgroup>
        <optgroup label={t.payerCommittees}>
          {DEPARTMENTS.map((department) => (
            <option
              key={department.code}
              value={payerKey({ kind: "committee", department: department.code })}
            >
              {`CD${department.code} – ${department.name}`}
            </option>
          ))}
        </optgroup>
      </select>
      <p id={hintId} className="text-sm text-muted-foreground">
        {t.payerHint}
      </p>
      {error !== null && (
        <p id={errorId} className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
