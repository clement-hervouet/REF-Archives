"use client";

/**
 * Carte d'un club (§15.4.1), sur le modèle des collègues : pastille (petit logo FFBB en haut
 * à droite si le club est lié à la FFBB), nom, salle principale (ou mention « à
 * compléter »), autres salles, deux icônes discrètes (modifier, supprimer). La
 * modification s'ouvre dans la carte et se referme après l'enregistrement ; la
 * confirmation de suppression passe en dessous.
 */
import { Pencil } from "lucide-react";
import { useCallback, useState } from "react";
import { ConfirmActionButton } from "@/components/features/games/confirm-action-button";
import { isCompleteAddress, venueLabel } from "@/components/features/compensations/address-label";
import { fr } from "@/i18n/fr";
import type { ClubFormState, DeleteClubState } from "@/server/clubs/manage-clubs";
import type { ClubSummary } from "@/server/db/clubs";
import { ClubBadge } from "./club-badge";
import { ClubFfbbLink } from "./club-ffbb-link";
import { ClubForm } from "./club-form";
import { ClubVenues } from "./club-venues";
import type { ClubVenueActions } from "./club-venues";

const t = fr.clubs;

/** Ballon du logo FFBB seul (sans le sigle), 96 px. */
const FFBB_LOGO_PATH = "/images/ffbb.webp";

type Props = {
  club: ClubSummary;
  updateAction: (previous: ClubFormState, formData: FormData) => Promise<ClubFormState>;
  deleteAction: (previous: DeleteClubState, formData: FormData) => Promise<DeleteClubState>;
  venueActions: ClubVenueActions;
};

const ICON_BUTTON_CLASS =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground aria-expanded:bg-accent aria-expanded:text-foreground";

export function ClubCard({ club, updateAction, deleteAction, venueActions }: Props) {
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
        {/* Hors de la pastille, qui rogne ce qui dépasse de son cercle. */}
        <span className="relative mt-1 mr-2 shrink-0">
          <ClubBadge
            club={{
              id: club.id,
              name: club.name,
              color: club.ffbb?.color ?? null,
              logoUuid: club.ffbb?.logoUuid ?? null,
            }}
          />
          {club.ffbb !== null && (
            <span
              aria-hidden="true"
              title={t.ffbb.link.linked}
              className="absolute -top-1 -right-1 flex size-5"
            >
              {/* Fichier statique déjà à la bonne taille : pas d'optimisation Next.js. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={FFBB_LOGO_PATH} alt="" width={18} height={18} className="size-full" />
            </span>
          )}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5 pt-1">
          <h2 className="font-semibold break-words">{club.name}</h2>
          {club.ffbb !== null && <p className="sr-only">{t.ffbb.link.linked}</p>}
          {club.venues.length > 0 && (
            <p className="text-sm text-muted-foreground">{fr.clubs.venues.main}</p>
          )}
          <p className="text-sm break-words">{venueLabel(address)}</p>
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
      <ClubFfbbLink club={club} />
      <ClubVenues club={club} actions={venueActions} />
      {editing && (
        <div id={formId} className="border-t border-border pt-3">
          <ClubForm
            action={updateAction}
            initialValues={{
              clubId: club.id,
              name: club.name,
              venueName: address.name ?? "",
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
