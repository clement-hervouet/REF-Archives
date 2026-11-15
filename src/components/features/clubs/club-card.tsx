"use client";

/**
 * Carte d'un club (§15.4.1), sur le modèle des collègues : nom, adresse connue (ou
 * mention « à compléter »), deux icônes discrètes (modifier, supprimer). La modification
 * s'ouvre dans la carte et se referme après l'enregistrement ; la confirmation de
 * suppression passe en dessous.
 */
import { Pencil } from "lucide-react";
import { useCallback, useState } from "react";
import { ConfirmActionButton } from "@/components/features/games/confirm-action-button";
import { addressLabel, isCompleteAddress } from "@/components/features/compensations/address-label";
import { fr } from "@/i18n/fr";
import type { ClubFormState, DeleteClubState } from "@/server/clubs/manage-clubs";
import type { ClubSummary } from "@/server/db/clubs";
import { ClubForm } from "./club-form";

const t = fr.clubs;

type Props = {
  club: ClubSummary;
  updateAction: (previous: ClubFormState, formData: FormData) => Promise<ClubFormState>;
  deleteAction: (previous: DeleteClubState, formData: FormData) => Promise<DeleteClubState>;
};

const ICON_BUTTON_CLASS =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground aria-expanded:bg-accent aria-expanded:text-foreground";

export function ClubCard({ club, updateAction, deleteAction }: Props) {
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const formId = `club-edit-${club.id}`;
  const close = useCallback(() => {
    setEditing(false);
  }, []);
  const onSaved = useCallback(() => {
    setEditing(false);
    setSaved(true);
  }, []);
  const { address } = club;

  return (
    <article className="flex flex-col gap-3 rounded-md border border-border p-4">
      <div className="flex flex-wrap items-start gap-x-1 gap-y-3">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5 pt-1">
          <h2 className="font-semibold break-words">{club.name}</h2>
          <p className="text-sm break-words">{addressLabel(address)}</p>
          {!isCompleteAddress(address) && (
            <p className="text-sm text-muted-foreground">{t.incomplete}</p>
          )}
        </div>
        <button
          type="button"
          aria-label={t.edit.label.replace("{name}", club.name)}
          title={t.edit.label.replace("{name}", club.name)}
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
          hidden={{ name: "clubId", value: club.id }}
          labels={{
            submit: t.delete.submit,
            ariaLabel: t.delete.label.replace("{name}", club.name),
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
          <ClubForm
            action={updateAction}
            initialValues={{
              clubId: club.id,
              name: club.name,
              street: address.street ?? "",
              number: address.number ?? "",
              postalCode: address.postalCode,
              city: address.city ?? "",
              country: address.country ?? "",
            }}
            labels={{
              submit: t.edit.submit,
              submitting: t.edit.submitting,
              ariaLabel: t.edit.formLabel.replace("{name}", club.name),
            }}
            onSuccess={onSaved}
            onCancel={close}
          />
        </div>
      )}
    </article>
  );
}
