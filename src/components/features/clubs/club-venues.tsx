"use client";

/**
 * Autres salles d'un club, dans sa carte (§15.4.1) : chacune peut devenir la salle
 * principale ou être retirée. « Ajouter des salles » ouvre l'import depuis l'annuaire FFBB
 * (salles où le club reçoit cette saison, à cocher) ou la saisie d'une salle. Le résultat
 * est annoncé sous la liste ; la page, revalidée, affiche les salles à jour.
 */
import { useActionState, useId, useState } from "react";
import { venueLabel } from "@/components/features/compensations/address-label";
import {
  FormMessage,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  TextField,
} from "@/components/features/scales/form-parts";
import { useScaleForm } from "@/components/features/scales/use-scale-form";
import { fr } from "@/i18n/fr";
import type { ClubVenue } from "@/lib/schemas/compensations";
import type { ClubVenueField, ClubVenueState } from "@/server/clubs/manage-clubs";
import type { AddressSummary, ClubSummary } from "@/server/db/clubs";
import type { FfbbClubDetails } from "@/server/ffbb/ffbb-clubs";
import { clubVenueFieldError, clubVenueStatusMessage } from "./club-messages";
import { FfbbClubSearch } from "./ffbb-club-search";
import { VenueChecklist, checkedByDefault } from "./venue-checklist";

const t = fr.clubs.venues;

type VenueAction = (previous: ClubVenueState, formData: FormData) => Promise<ClubVenueState>;

export type ClubVenueActions = { add: VenueAction; remove: VenueAction; setMain: VenueAction };

type Props = { club: ClubSummary; actions: ClubVenueActions };

const IDLE: ClubVenueState = { status: "idle" };

const LINK_CLASS = "self-start text-sm font-medium text-primary underline underline-offset-2";

export function ClubVenues({ club, actions }: Props) {
  const panelId = useId();
  const [adding, setAdding] = useState(false);
  const [announce, setAnnounce] = useState("");

  return (
    <div className="flex flex-col gap-2">
      {club.venues.length > 0 && (
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-medium">{t.others}</h3>
          <ul className="flex flex-col gap-1">
            {club.venues.map((venue) => (
              <li key={venue.id}>
                <VenueRow clubId={club.id} venue={venue} actions={actions} onDone={setAnnounce} />
              </li>
            ))}
          </ul>
        </div>
      )}
      <p role="status" className="text-sm font-medium empty:hidden">
        {announce}
      </p>
      <button
        type="button"
        aria-expanded={adding}
        aria-controls={adding ? panelId : undefined}
        onClick={() => {
          setAnnounce("");
          setAdding((open) => !open);
        }}
        className={LINK_CLASS}
      >
        {adding ? t.close : t.add}
      </button>
      {adding && (
        <div id={panelId} className="border-t border-border pt-3">
          <AddClubVenues
            clubId={club.id}
            action={actions.add}
            onAdded={(message) => {
              setAdding(false);
              setAnnounce(message);
            }}
          />
        </div>
      )}
    </div>
  );
}

type RowProps = {
  clubId: string;
  venue: AddressSummary;
  actions: ClubVenueActions;
  onDone: (message: string) => void;
};

/** Une autre salle : la rendre principale, ou la retirer du club. */
function VenueRow({ clubId, venue, actions, onDone }: RowProps) {
  const label = venueLabel(venue);
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className="min-w-0 flex-1 basis-48 text-sm break-words">{label}</span>
      <VenueButton
        action={actions.setMain}
        clubId={clubId}
        addressId={venue.id}
        text={t.setMain}
        ariaLabel={t.setMainLabel.replace("{venue}", label)}
        onDone={onDone}
      />
      <VenueButton
        action={actions.remove}
        clubId={clubId}
        addressId={venue.id}
        text={t.remove}
        ariaLabel={t.removeLabel.replace("{venue}", label)}
        onDone={onDone}
      />
    </div>
  );
}

type ButtonProps = {
  action: VenueAction;
  clubId: string;
  addressId: string;
  text: string;
  ariaLabel: string;
  onDone: (message: string) => void;
};

/**
 * Formulaire d'un seul bouton. Le succès est annoncé par la liste (la ligne disparaît ou
 * change de place à la revalidation) ; un refus reste affiché à côté du bouton.
 */
function VenueButton({ action, clubId, addressId, text, ariaLabel, onDone }: ButtonProps) {
  const [state, formAction, isPending] = useActionState<ClubVenueState, FormData>(
    async (previous, formData) => {
      const next = await action(previous, formData);
      const message = clubVenueStatusMessage(next);
      if (message?.tone === "success") {
        onDone(message.text);
      }
      return next;
    },
    IDLE,
  );
  const message = clubVenueStatusMessage(state);
  return (
    <form action={formAction} className="contents">
      <input type="hidden" name="clubId" value={clubId} />
      <input type="hidden" name="addressId" value={addressId} />
      <button
        type="submit"
        disabled={isPending}
        aria-label={ariaLabel}
        title={ariaLabel}
        className={`${SECONDARY_BUTTON_CLASS} text-sm`}
      >
        {text}
      </button>
      {message?.tone === "error" && (
        <p role="alert" className="basis-full text-sm font-medium text-destructive">
          {message.text}
        </p>
      )}
    </form>
  );
}

type Mode =
  | { kind: "search" }
  | {
      kind: "picked";
      clubName: string;
      /** Ville de la salle principale du club : ses salles sont cochées au départ. */
      homeCity: string | null;
      venues: readonly ClubVenue[];
    }
  | { kind: "manual"; notice: string | null };

/** Salles du club trouvé dans l'annuaire : la principale (code postal connu), puis les autres. */
function ffbbVenuesOf(club: FfbbClubDetails): ClubVenue[] {
  const main: ClubVenue[] =
    club.postalCode === null
      ? []
      : [
          {
            name: club.venue,
            street: club.street,
            number: club.number,
            postalCode: club.postalCode,
            city: club.city,
          },
        ];
  return [...main, ...club.venues];
}

type AddProps = { clubId: string; action: VenueAction; onAdded: (message: string) => void };

function AddClubVenues({ clubId, action, onAdded }: AddProps) {
  const id = useId();
  const [mode, setMode] = useState<Mode>({ kind: "search" });
  const backToSearch = (
    <button
      type="button"
      onClick={() => {
        setMode({ kind: "search" });
      }}
      className={LINK_CLASS}
    >
      {fr.clubs.ffbb.backToSearch}
    </button>
  );

  if (mode.kind === "search") {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">{t.intro}</p>
        <FfbbClubSearch
          idBase={id}
          onPick={(club) => {
            const venues = ffbbVenuesOf(club);
            setMode(
              venues.length === 0
                ? { kind: "manual", notice: t.noneFound }
                : { kind: "picked", clubName: club.name, homeCity: club.city, venues },
            );
          }}
          onManual={(notice) => {
            setMode({ kind: "manual", notice });
          }}
        />
      </div>
    );
  }

  if (mode.kind === "picked") {
    return (
      <div className="flex flex-col gap-3">
        <ImportVenuesForm
          clubId={clubId}
          clubName={mode.clubName}
          homeCity={mode.homeCity}
          venues={mode.venues}
          action={action}
          onAdded={onAdded}
        />
        {backToSearch}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {mode.notice !== null && (
        <p role="status" className="text-sm text-muted-foreground">
          {mode.notice}
        </p>
      )}
      <ManualVenueForm idBase={id} clubId={clubId} action={action} onAdded={onAdded} />
      {backToSearch}
    </div>
  );
}

type ImportProps = {
  clubId: string;
  clubName: string;
  homeCity: string | null;
  venues: readonly ClubVenue[];
  action: VenueAction;
  onAdded: (message: string) => void;
};

/** Salles trouvées dans l'annuaire, à cocher puis à ajouter en un envoi. */
function ImportVenuesForm({ clubId, clubName, homeCity, venues, action, onAdded }: ImportProps) {
  const [selected, setSelected] = useState(
    () => checkedByDefault(venues, homeCity).filter(Boolean).length,
  );
  const [state, formAction, isPending] = useActionState<ClubVenueState, FormData>(
    async (previous, formData) => {
      const next = await action(previous, formData);
      const message = clubVenueStatusMessage(next);
      if (next.status === "added" && message !== null) {
        onAdded(message.text);
      }
      return next;
    },
    IDLE,
  );
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <FormMessage message={state.status === "added" ? null : clubVenueStatusMessage(state)} />
      <input type="hidden" name="clubId" value={clubId} />
      <VenueChecklist
        venues={venues}
        homeCity={homeCity}
        name="venues"
        legend={t.pickedLegend.replace("{club}", clubName)}
        hint={t.pickedHint}
        onChange={(list) => {
          setSelected(list.length);
        }}
      />
      <button
        type="submit"
        disabled={isPending || selected === 0}
        className={`${PRIMARY_BUTTON_CLASS} self-start`}
      >
        {isPending ? t.submitting : t.importSubmit}
      </button>
    </form>
  );
}

type ManualProps = {
  idBase: string;
  clubId: string;
  action: VenueAction;
  onAdded: (message: string) => void;
};

/** Une salle saisie : nom, rue, numéro, code postal (obligatoire) et ville. */
function ManualVenueForm({ idBase, clubId, action, onAdded }: ManualProps) {
  const { state, valueOf, formKey, formAction, isPending } = useScaleForm(
    async (previous: ClubVenueState, formData: FormData) => {
      const next = await action(previous, formData);
      const message = clubVenueStatusMessage(next);
      if (next.status === "added" && message !== null) {
        onAdded(message.text);
      }
      return next;
    },
    IDLE,
    ["added"],
  );

  const field = (
    field: Exclude<ClubVenueField, "venues">,
    name: string,
    maxLength: number,
    required = false,
  ) => (
    <TextField
      id={`${idBase}-venue-${name}`}
      name={name}
      label={t.fields[field]}
      maxLength={maxLength}
      required={required}
      defaultValue={valueOf(name)}
      error={clubVenueFieldError(field, state)}
    />
  );

  return (
    <form key={formKey} action={formAction} className="@container flex flex-col gap-3">
      <FormMessage message={clubVenueStatusMessage(state)} />
      <input type="hidden" name="clubId" value={clubId} />
      {field("name", "venueName", 255)}
      <div className="grid gap-3 @md:grid-cols-[minmax(0,1fr)_8rem]">
        {field("street", "street", 255)}
        {field("number", "number", 20)}
      </div>
      <div className="grid gap-3 @md:grid-cols-[8rem_minmax(0,1fr)]">
        {field("postalCode", "postalCode", 10, true)}
        {field("city", "city", 255)}
      </div>
      <button type="submit" disabled={isPending} className={`${PRIMARY_BUTTON_CLASS} self-start`}>
        {isPending ? t.submitting : t.manualSubmit}
      </button>
    </form>
  );
}
