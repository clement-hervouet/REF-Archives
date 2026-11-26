"use client";

/**
 * Panneau « Partage » de la préparation, côté propriétaire (migration 035) : un arbitre
 * collègue par ligne, avec ce qu'on peut faire selon son état.
 *  * Fiche liée à un compte : « Partager » en un clic, ou « Arrêter le partage ».
 *  * Fiche pas encore liée : « Créer un lien de partage », à envoyer à la main (copie ou
 *    menu de partage du téléphone). Le lien n'est affiché qu'une fois ; ensuite, la ligne
 *    dit seulement qu'un lien attend, avec « Nouveau lien » et « Annuler le lien ».
 */
import { useActionState, useState, useSyncExternalStore } from "react";
import {
  FormMessage,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@/components/features/scales/form-parts";
import type { ScaleMessage } from "@/components/features/scales/scale-messages";
import { fr } from "@/i18n/fr";
import { formatDateTime } from "@/lib/format";
import type { ShareState } from "@/server/sharing/sharing-form";

const t = fr.sharing.panel;

/** Arbitre collègue du match, en données sérialisables. */
type ShareCandidateView = {
  personId: string;
  /** Nom de la fiche chez le propriétaire. */
  name: string;
  /** Prénom et nom du compte lié, ou `null`. */
  linkedName: string | null;
  shared: boolean;
  /** Fin de validité du lien en attente (ISO), ou `null`. */
  pendingUntil: string | null;
};

type Action = (previous: ShareState, formData: FormData) => Promise<ShareState>;

type Props = {
  gameId: string;
  candidates: readonly ShareCandidateView[];
  /** Vrai si d'autres arbitres du match n'ont pas « a un compte » coché. */
  omitted: boolean;
  action: Action;
};

function stateMessage(state: ShareState): ScaleMessage | null {
  switch (state.status) {
    case "idle":
    case "link_created":
      return null;
    case "shared":
    case "stopped":
    case "revoked":
      return { tone: "success", text: t.messages[state.status] };
    default:
      return { tone: "error", text: t.messages[state.status] };
  }
}

function noSubscription(): () => void {
  return () => undefined;
}

/** Lien tout juste créé : copie et, si le téléphone le permet, menu de partage. */
function CreatedLink({
  id,
  name,
  url,
  expiresAt,
}: {
  id: string;
  name: string;
  url: string;
  expiresAt: string;
}) {
  const [copy, setCopy] = useState<"idle" | "copied" | "failed">("idle");
  // `navigator.share` n'existe qu'au navigateur : faux au rendu serveur (pas d'écart
  // d'hydratation), lu tel quel ensuite. Rien à écouter : la valeur ne change pas.
  const canSend = useSyncExternalStore(
    noSubscription,
    () => typeof navigator.share === "function",
    () => false,
  );
  const label = t.linkLabel.replace("{name}", name);

  return (
    <div className="flex flex-col gap-2 rounded-md border border-warning bg-warning/15 p-3">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        type="text"
        readOnly
        value={url}
        onFocus={(event) => {
          event.currentTarget.select();
        }}
        aria-describedby={`${id}-hint`}
        className="min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
      <p id={`${id}-hint`} className="text-sm">
        {t.linkHint.replace("{name}", name).replace("{date}", formatDateTime(new Date(expiresAt)))}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={SECONDARY_BUTTON_CLASS}
          onClick={() => {
            navigator.clipboard.writeText(url).then(
              () => {
                setCopy("copied");
              },
              () => {
                setCopy("failed");
              },
            );
          }}
        >
          {t.copy}
        </button>
        {canSend && (
          <button
            type="button"
            className={SECONDARY_BUTTON_CLASS}
            onClick={() => {
              // Annuler le menu de partage n'est pas une erreur à signaler.
              navigator.share({ title: t.sendTitle, text: t.sendText, url }).catch(() => undefined);
            }}
          >
            {t.send}
          </button>
        )}
      </div>
      {copy !== "idle" && (
        <p role="status" className="text-sm font-medium">
          {copy === "copied" ? t.copied : t.copyFailed}
        </p>
      )}
    </div>
  );
}

function CandidateRow({
  gameId,
  candidate,
  action,
}: {
  gameId: string;
  candidate: ShareCandidateView;
  action: Action;
}) {
  const [state, formAction, isPending] = useActionState(action, { status: "idle" });
  const { name, linkedName, shared, pendingUntil } = candidate;
  const status = shared
    ? t.shared
    : pendingUntil !== null
      ? t.pending.replace("{date}", formatDateTime(new Date(pendingUntil)))
      : null;
  const button = (intent: string, label: string, primary: boolean, ariaLabel?: string) => (
    <button
      type="submit"
      name="intent"
      value={intent}
      disabled={isPending}
      aria-label={ariaLabel}
      className={primary ? PRIMARY_BUTTON_CLASS : SECONDARY_BUTTON_CLASS}
    >
      {isPending ? t.pendingAction : label}
    </button>
  );

  return (
    <li className="flex flex-col gap-3 rounded-md border border-border p-3">
      <div className="flex flex-col gap-0.5">
        <p className="font-medium break-words">{name}</p>
        <p className="text-sm text-muted-foreground break-words">
          {linkedName === null ? t.notLinked : t.linkedTo.replace("{name}", linkedName)}
        </p>
        {status !== null && <p className="text-sm font-medium">{status}</p>}
      </div>
      <form action={formAction} className="flex flex-wrap gap-2">
        <input type="hidden" name="gameId" value={gameId} />
        <input type="hidden" name="personId" value={candidate.personId} />
        {linkedName !== null &&
          (shared
            ? button("stop", t.stop, false, t.stopLabel.replace("{name}", name))
            : button("share", t.share, true, t.shareLabel.replace("{name}", name)))}
        {linkedName === null &&
          (pendingUntil === null ? (
            button("link", t.createLink, true)
          ) : (
            <>
              {button("link", t.newLink, false)}
              {button("revoke", t.revokeLink, false)}
            </>
          ))}
      </form>
      {state.status === "link_created" && (
        <CreatedLink
          id={`share-link-${candidate.personId}`}
          name={name}
          url={state.url}
          expiresAt={state.expiresAt}
        />
      )}
      <FormMessage message={stateMessage(state)} />
    </li>
  );
}

export function SharePanel({ gameId, candidates, omitted, action }: Props) {
  return (
    <section
      aria-labelledby="preparation-sharing"
      className="flex flex-col gap-3 rounded-md border border-border p-4"
    >
      <h2 id="preparation-sharing" className="text-lg font-semibold">
        {t.legend}
      </h2>
      {candidates.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.none}</p>
      ) : (
        <>
          <p className="max-w-2xl text-sm text-muted-foreground">{t.intro}</p>
          <ul className="flex flex-col gap-3">
            {candidates.map((candidate) => (
              <CandidateRow
                key={candidate.personId}
                gameId={gameId}
                candidate={candidate}
                action={action}
              />
            ))}
          </ul>
          {omitted && <p className="text-sm text-muted-foreground">{t.omitted}</p>}
        </>
      )}
    </section>
  );
}
