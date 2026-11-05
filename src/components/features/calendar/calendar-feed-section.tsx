"use client";

/**
 * Section « Abonnement calendrier » de la page « Paramètres » : créer, régénérer ou révoquer
 * le lien iCal. L'URL n'est connue qu'au retour de l'action de création (seule son empreinte
 * est en base) : elle est affichée à ce moment-là, puis disparaît au rechargement.
 * Régénérer et révoquer coupent les abonnements existants : un second clic les confirme.
 * La confirmation est liée à l'état courant de l'action : dès que l'action renvoie un
 * nouvel état, elle se referme d'elle-même (pas d'effet à synchroniser).
 */
import { useActionState, useId, useState } from "react";
import {
  FormMessage,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@/components/features/scales/form-parts";
import { fr } from "@/i18n/fr";
import type { CalendarFeedState } from "@/server/calendar/manage-feed";
import { calendarFeedMessage } from "./calendar-messages";

const t = fr.calendar.settings;

type ConfirmKind = "regenerate" | "revoke";
type CopyStatus = "idle" | "copied" | "failed";

type Props = {
  /** Date de création du lien déjà formatée (JJ/MM/AAAA), ou `null` sans lien. */
  activeSince: string | null;
  action: (previous: CalendarFeedState, formData: FormData) => Promise<CalendarFeedState>;
};

function CreatedLink({ url, webcalUrl }: { url: string; webcalUrl: string }) {
  const id = useId();
  const [copy, setCopy] = useState<CopyStatus>("idle");
  const urlId = `${id}-url`;
  const warningId = `${id}-warning`;

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(url);
      setCopy("copied");
    } catch {
      // Presse-papiers refusé (contexte non sécurisé, permission) : copie manuelle.
      setCopy("failed");
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-warning bg-warning/15 p-4">
      <label htmlFor={urlId} className="text-sm font-medium">
        {t.urlLabel}
      </label>
      <input
        id={urlId}
        type="text"
        readOnly
        value={url}
        aria-describedby={warningId}
        onFocus={(event) => {
          event.currentTarget.select();
        }}
        className="min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm"
      />
      <p id={warningId} className="text-sm font-medium">
        {t.urlOnce}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            void copyUrl();
          }}
          className={PRIMARY_BUTTON_CLASS}
        >
          {t.copy}
        </button>
        <a
          href={webcalUrl}
          className="inline-flex min-h-11 items-center rounded-md border border-input bg-background px-4"
        >
          {t.openInApp}
        </a>
      </div>
      <p role="status" className="text-sm">
        {copy === "copied" ? t.copied : copy === "failed" ? t.copyFailed : ""}
      </p>
      <p className="text-sm text-muted-foreground">{t.howTo}</p>
    </div>
  );
}

function ConfirmBox({
  warning,
  confirmLabel,
  intent,
  isPending,
  onCancel,
}: {
  warning: string;
  confirmLabel: string;
  intent: "create" | "revoke";
  isPending: boolean;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-destructive p-3">
      <p className="text-sm">{warning}</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          name="intent"
          value={intent}
          disabled={isPending}
          className="min-h-11 rounded-md bg-destructive px-4 py-2 font-medium text-destructive-foreground disabled:opacity-60"
        >
          {isPending ? t.pending : confirmLabel}
        </button>
        <button type="button" onClick={onCancel} className={SECONDARY_BUTTON_CLASS}>
          {t.cancel}
        </button>
      </div>
    </div>
  );
}

export function CalendarFeedSection({ activeSince, action }: Props) {
  const [state, formAction, isPending] = useActionState(action, { status: "idle" });
  const [confirming, setConfirming] = useState<{
    kind: ConfirmKind;
    forState: CalendarFeedState;
  } | null>(null);
  const confirm = confirming !== null && confirming.forState === state ? confirming.kind : null;
  const hasLink = activeSince !== null;

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <p className="text-muted-foreground">{t.intro}</p>
      <p className="text-sm text-muted-foreground">{t.content}</p>
      <FormMessage message={calendarFeedMessage(state.status)} />
      {state.status === "created" && <CreatedLink url={state.url} webcalUrl={state.webcalUrl} />}
      <p className="font-medium">
        {hasLink ? t.activeSince.replace("{date}", () => activeSince) : t.none}
      </p>
      <form action={formAction} className="flex flex-col gap-3">
        {!hasLink && (
          <button
            type="submit"
            name="intent"
            value="create"
            disabled={isPending}
            className={`${PRIMARY_BUTTON_CLASS} self-start`}
          >
            {isPending ? t.pending : t.create}
          </button>
        )}
        {hasLink && confirm === null && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setConfirming({ kind: "regenerate", forState: state });
              }}
              className={SECONDARY_BUTTON_CLASS}
            >
              {t.regenerate}
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirming({ kind: "revoke", forState: state });
              }}
              className={SECONDARY_BUTTON_CLASS}
            >
              {t.revoke}
            </button>
          </div>
        )}
        {hasLink && confirm === "regenerate" && (
          <ConfirmBox
            warning={t.regenerateWarning}
            confirmLabel={t.confirmRegenerate}
            intent="create"
            isPending={isPending}
            onCancel={() => {
              setConfirming(null);
            }}
          />
        )}
        {hasLink && confirm === "revoke" && (
          <ConfirmBox
            warning={t.revokeWarning}
            confirmLabel={t.confirmRevoke}
            intent="revoke"
            isPending={isPending}
            onCancel={() => {
              setConfirming(null);
            }}
          />
        )}
      </form>
    </div>
  );
}
