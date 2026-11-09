"use client";

/**
 * Carte d'un collègue (bloc 10) : nom, club et mention « a un compte », avec deux icônes
 * discrètes (modifier, supprimer). La modification s'ouvre dans la carte et se referme
 * après l'enregistrement ; la confirmation de suppression passe en dessous.
 */
import { Pencil } from "lucide-react";
import { useCallback, useState } from "react";
import { fr } from "@/i18n/fr";
import type { Colleague } from "@/server/db/persons";
import type { ColleagueFormState, DeleteColleagueState } from "@/server/games/colleagues-form";
import { ColleagueForm } from "./colleague-form";
import type { ClubOption } from "./colleague-form";
import { ConfirmActionButton } from "./confirm-action-button";

const t = fr.colleagues;

type Props = {
  colleague: Colleague;
  name: string;
  clubs: readonly ClubOption[];
  updateAction: (previous: ColleagueFormState, formData: FormData) => Promise<ColleagueFormState>;
  deleteAction: (
    previous: DeleteColleagueState,
    formData: FormData,
  ) => Promise<DeleteColleagueState>;
};

const ICON_BUTTON_CLASS =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground aria-expanded:bg-accent aria-expanded:text-foreground";

export function ColleagueCard({ colleague, name, clubs, updateAction, deleteAction }: Props) {
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const formId = `colleague-edit-${colleague.id}`;
  const close = useCallback(() => {
    setEditing(false);
  }, []);
  const onSaved = useCallback(() => {
    setEditing(false);
    setSaved(true);
  }, []);
  const details = [colleague.club?.name ?? t.club.missing];
  if (colleague.hasAccount) {
    details.push(fr.games.officials.hasAccountBadge);
  }

  return (
    <article className="flex flex-col gap-3 rounded-md border border-border p-4">
      <div className="flex flex-wrap items-start gap-x-1 gap-y-3">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5 pt-1">
          <h2 className="font-semibold break-words">{name}</h2>
          <p className="text-sm text-muted-foreground">{details.join(" · ")}</p>
        </div>
        <button
          type="button"
          aria-label={t.edit.label.replace("{name}", name)}
          title={t.edit.label.replace("{name}", name)}
          aria-expanded={editing}
          aria-controls={editing ? formId : undefined}
          onClick={() => {
            setSaved(false);
            setEditing((open) => !open);
          }}
          className={ICON_BUTTON_CLASS}
        >
          <Pencil aria-hidden="true" className="size-4" />
        </button>
        <ConfirmActionButton
          variant="icon"
          action={deleteAction}
          hidden={{ name: "personId", value: colleague.id }}
          labels={{
            submit: t.delete.submit,
            ariaLabel: t.delete.label.replace("{name}", name),
            warning: t.delete.warning,
            confirm: t.delete.confirm,
            cancel: t.delete.cancel,
          }}
          messages={{ in_use: t.delete.inUse, not_found: t.errors.notFound }}
        />
      </div>
      {saved && (
        <p role="status" className="border-l-4 border-success pl-3 text-sm font-medium">
          {t.edit.updated}
        </p>
      )}
      {editing && (
        <div id={formId} className="border-t border-border pt-3">
          <ColleagueForm
            action={updateAction}
            clubs={clubs}
            layout="stacked"
            initialValues={{
              personId: colleague.id,
              lastname: colleague.lastname,
              firstname: colleague.firstname ?? "",
              clubId: colleague.club?.id ?? "",
              hasAccount: colleague.hasAccount ? "on" : "",
            }}
            labels={{
              submit: t.edit.submit,
              submitting: t.edit.submitting,
              ariaLabel: t.edit.formLabel.replace("{name}", name),
            }}
            onSuccess={onSaved}
            onCancel={close}
          />
        </div>
      )}
    </article>
  );
}
