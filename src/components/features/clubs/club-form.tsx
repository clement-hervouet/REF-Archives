"use client";

/**
 * Fiche d'un club (§15.4.1) : nom et code postal obligatoires ; nom de la salle principale,
 * rue, numéro, ville et pays facultatifs. Sert à l'ajout (formulaire vidé après succès) et
 * à la modification dans la carte du club (champ caché `clubId`, vérifié côté serveur ;
 * `onSuccess` referme la carte). Grille en requêtes de conteneur : elle suit la largeur de
 * la carte, pas celle de l'écran.
 *
 * Ajout : on cherche d'abord le club dans l'annuaire FFBB par sa ville ; le club choisi
 * pré-remplit la fiche (sa salle principale) et propose ses autres salles, à cocher. Si la
 * recherche échoue ou sur demande, la fiche s'affiche vide, à saisir comme avant.
 */
import { useEffect, useId, useState } from "react";
import {
  FormMessage,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  TextField,
} from "@/components/features/scales/form-parts";
import { useScaleForm } from "@/components/features/scales/use-scale-form";
import { fr } from "@/i18n/fr";
import type { ClubField } from "@/lib/schemas/clubs";
import type { ClubVenue } from "@/lib/schemas/compensations";
import type { FfbbClubLink } from "@/lib/schemas/ffbb-link";
import type { ClubFormState } from "@/server/clubs/manage-clubs";
import type { FfbbClubDetails } from "@/server/ffbb/ffbb-clubs";
import { clubFieldError, clubStatusMessage } from "./club-messages";
import { FfbbClubSearch } from "./ffbb-club-search";
import { keptFfbbLink, keptVenues } from "./new-club-fields";
import { VenueChecklist } from "./venue-checklist";

const t = fr.clubs;

type Props = {
  action: (previous: ClubFormState, formData: FormData) => Promise<ClubFormState>;
  /** Modification : valeurs de départ, dont `clubId`. Sans elles : ajout. */
  initialValues?: Readonly<Record<string, string>>;
  labels: { submit: string; submitting: string; ariaLabel?: string };
  onSuccess?: () => void;
  onCancel?: () => void;
};

/** Champs texte de la fiche (les autres salles partent en liste, à part). */
type ClubTextField = Exclude<ClubField, "venues">;

const MAX_LENGTHS: Record<ClubTextField, number> = {
  name: 255,
  venueName: 255,
  street: 255,
  number: 20,
  postalCode: 10,
  city: 255,
  country: 100,
};

const REQUIRED: readonly ClubTextField[] = ["name", "postalCode"];

/**
 * Étape de l'ajout : recherche FFBB, ou fiche (pré-remplie par le club choisi, `prefill`,
 * ou vide). Liée au `formKey` : après un ajout réussi, on repart de la recherche ; après un
 * refus, de la fiche avec la saisie conservée.
 */
type AddStep = {
  key: number;
  step: "search" | "form";
  prefill: Readonly<Record<ClubTextField, string>> | null;
  /** Autres salles du club choisi, proposées à l'ajout. */
  venues: readonly ClubVenue[];
  /** Ville du club choisi : ses salles sont cochées au départ (`null` : toutes). */
  homeCity: string | null;
  /** Lien FFBB du club choisi (logo, couleur), envoyé avec la fiche. */
  ffbb: FfbbClubLink | null;
  notice: string | null;
  /** Remonte la fiche à chaque pré-remplissage (champs non contrôlés). */
  version: number;
};

function prefillOf(club: FfbbClubDetails): Record<ClubTextField, string> {
  return {
    name: club.name,
    venueName: club.venue ?? "",
    street: club.street ?? "",
    number: club.number ?? "",
    postalCode: club.postalCode ?? "",
    city: club.city ?? "",
    country: "",
  };
}

export function ClubForm({ action, initialValues, labels, onSuccess, onCancel }: Props) {
  const id = useId();
  const editing = initialValues !== undefined;
  const { state, valueOf, formKey, formAction, isPending } = useScaleForm(
    action,
    { status: "idle" },
    editing ? [] : ["created"],
    initialValues,
  );

  useEffect(() => {
    if (state.status === "updated") {
      onSuccess?.();
    }
  }, [state, onSuccess]);

  const [addStep, setAddStep] = useState<AddStep>({
    key: formKey,
    step: "search",
    prefill: null,
    venues: [],
    homeCity: null,
    ffbb: null,
    notice: null,
    version: 0,
  });
  const current: AddStep =
    addStep.key === formKey
      ? addStep
      : {
          key: formKey,
          step: state.status === "created" ? "search" : "form",
          prefill: null,
          // Ajout refusé : les salles cochées sont reproposées.
          venues: state.status === "created" ? [] : keptVenues(valueOf("venues")),
          // Ajout refusé : seules les salles cochées reviennent, toutes cochées.
          homeCity: null,
          ffbb: state.status === "created" ? null : keptFfbbLink(valueOf("ffbb")),
          notice: null,
          version: addStep.version + 1,
        };
  const step = editing ? "form" : current.step;
  const showForm = (
    prefill: AddStep["prefill"],
    venues: AddStep["venues"],
    homeCity: string | null,
    ffbb: FfbbClubLink | null,
    notice: string | null,
  ) => {
    setAddStep({
      ...current,
      step: "form",
      prefill,
      venues,
      homeCity,
      ffbb,
      notice,
      version: current.version + 1,
    });
  };

  const field = (name: ClubTextField) => (
    <TextField
      id={`${id}-${name}`}
      name={name}
      label={t.fields[name]}
      maxLength={MAX_LENGTHS[name]}
      required={REQUIRED.includes(name)}
      defaultValue={current.prefill?.[name] ?? valueOf(name)}
      error={clubFieldError(name, state)}
      uppercase={name === "name"}
    />
  );

  return (
    <div className="flex flex-col gap-3">
      {/* En modification, la carte annonce elle-même le succès en se refermant. */}
      {!(editing && state.status === "updated") && (
        <FormMessage message={clubStatusMessage(state)} />
      )}
      {step === "search" && (
        <div className="max-w-3xl">
          <FfbbClubSearch
            idBase={id}
            onPick={(club) => {
              showForm(
                prefillOf(club),
                club.venues,
                club.city,
                club.ffbb,
                club.postalCode === null ? t.ffbb.missingPostalCode : t.ffbb.prefilled,
              );
            }}
            onManual={(notice) => {
              showForm(null, [], null, null, notice);
            }}
          />
        </div>
      )}
      {step === "form" && !editing && (
        <div className="flex max-w-3xl flex-col items-start gap-2">
          {current.notice !== null && (
            <p role="status" className="text-sm text-muted-foreground">
              {current.notice}
            </p>
          )}
          <button
            type="button"
            onClick={() => {
              setAddStep({
                ...current,
                step: "search",
                prefill: null,
                venues: [],
                homeCity: null,
                ffbb: null,
                notice: null,
              });
            }}
            className="text-sm font-medium text-primary underline underline-offset-2"
          >
            {t.ffbb.backToSearch}
          </button>
        </div>
      )}
      {step === "form" && (
        <form
          key={`${String(formKey)}-${String(current.version)}`}
          action={formAction}
          aria-label={labels.ariaLabel}
          className="@container flex max-w-3xl flex-col gap-3"
        >
          {editing && <input type="hidden" name="clubId" value={valueOf("clubId")} />}
          {!editing && current.ffbb !== null && (
            <input type="hidden" name="ffbb" value={JSON.stringify(current.ffbb)} />
          )}
          <div className="grid gap-3 @md:grid-cols-[minmax(0,1fr)_8rem]">
            {field("name")}
            {field("postalCode")}
          </div>
          {field("venueName")}
          <div className="grid gap-3 @md:grid-cols-[minmax(0,1fr)_8rem]">
            {field("street")}
            {field("number")}
          </div>
          <div className="grid gap-3 @md:grid-cols-[minmax(0,1fr)_minmax(0,12rem)]">
            {field("city")}
            {field("country")}
          </div>
          {!editing && current.venues.length > 0 && (
            <VenueChecklist
              venues={current.venues}
              homeCity={current.homeCity}
              name="venues"
              legend={t.venues.importLegend}
              hint={t.venues.importHint}
            />
          )}
          {clubFieldError("venues", state) !== null && (
            <p className="text-sm font-medium text-destructive">
              {clubFieldError("venues", state)}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={isPending} className={PRIMARY_BUTTON_CLASS}>
              {isPending ? labels.submitting : labels.submit}
            </button>
            {onCancel !== undefined && (
              <button type="button" onClick={onCancel} className={SECONDARY_BUTTON_CLASS}>
                {t.edit.cancel}
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
