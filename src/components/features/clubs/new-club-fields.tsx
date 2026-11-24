"use client";

/**
 * Nouveau club créé depuis un formulaire (indemnité, match, collègue), §15.4.1. Par défaut,
 * recherche dans l'annuaire FFBB par ville : le club choisi est résumé à l'écran et ses
 * champs (nom, rue, numéro, code postal, ville) partent en champs cachés. Si la recherche
 * échoue ou sur demande : saisie manuelle du nom et du code postal, comme avant.
 *
 * Rendu dans un `<form>` remonté après chaque envoi : le mode repart des valeurs conservées
 * (club choisi si son adresse est là, saisie manuelle sinon, recherche si rien n'est saisi).
 */
import { useEffect, useRef, useState } from "react";
import { addressLabel } from "@/components/features/compensations/address-label";
import { TextField } from "@/components/features/scales/form-parts";
import { fr } from "@/i18n/fr";
import type { FfbbClubDetails } from "@/server/ffbb/ffbb-clubs";
import { FfbbClubSearch } from "./ffbb-club-search";

const t = fr.clubs.ffbb;

/** Noms des champs HTML envoyés au serveur (`venue` : nom de la salle, ignoré par lui). */
type NewClubInputNames = {
  name: string;
  postalCode: string;
  street: string;
  number: string;
  city: string;
  venue: string;
};

type PickedClub = {
  name: string;
  venue: string | null;
  street: string | null;
  number: string | null;
  postalCode: string;
  city: string | null;
};

type Mode =
  | { kind: "search" }
  | { kind: "picked"; club: PickedClub }
  | {
      kind: "manual";
      notice: string | null;
      /** Valeurs de départ (club FFBB sans code postal), sinon celles conservées. */
      prefill: { name: string; postalCode: string } | null;
    };

type Props = {
  idBase: string;
  names: NewClubInputNames;
  labels: { name: string; postalCode: string; postalCodeHint?: string };
  valueOf: (name: string) => string;
  errors: { name: string | null; postalCode: string | null };
  /** Appelé après chaque changement de mode, une fois le DOM à jour (récapitulatif). */
  onResolved?: (() => void) | undefined;
};

function orNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/** Mode au montage, d'après les valeurs conservées après un envoi refusé. */
function initialMode(
  names: NewClubInputNames,
  valueOf: (name: string) => string,
  hasError: boolean,
): Mode {
  const name = valueOf(names.name);
  const postalCode = valueOf(names.postalCode);
  if (name === "" && postalCode === "") {
    return { kind: "search" };
  }
  const street = orNull(valueOf(names.street));
  const city = orNull(valueOf(names.city));
  if (!hasError && (street !== null || city !== null)) {
    return {
      kind: "picked",
      club: {
        name,
        postalCode,
        street,
        city,
        number: orNull(valueOf(names.number)),
        venue: orNull(valueOf(names.venue)),
      },
    };
  }
  return { kind: "manual", notice: null, prefill: null };
}

export function NewClubFields({ idBase, names, labels, valueOf, errors, onResolved }: Props) {
  const hasError = errors.name !== null || errors.postalCode !== null;
  const [mode, setMode] = useState<Mode>(() => initialMode(names, valueOf, hasError));

  // Le parent relit le formulaire une fois les champs du mode affichés.
  const onResolvedRef = useRef(onResolved);
  useEffect(() => {
    onResolvedRef.current = onResolved;
  }, [onResolved]);
  useEffect(() => {
    onResolvedRef.current?.();
  }, [mode]);

  function pick(club: FfbbClubDetails) {
    if (club.postalCode === null) {
      setMode({
        kind: "manual",
        notice: t.missingPostalCode,
        prefill: { name: club.name, postalCode: "" },
      });
      return;
    }
    setMode({ kind: "picked", club: { ...club, postalCode: club.postalCode } });
  }

  if (mode.kind === "search") {
    return (
      <FfbbClubSearch
        idBase={idBase}
        onPick={pick}
        onManual={(notice) => {
          setMode({ kind: "manual", notice, prefill: null });
        }}
        error={hasError ? t.required : null}
      />
    );
  }

  const backToSearch = (label: string) => (
    <button
      type="button"
      onClick={() => {
        setMode({ kind: "search" });
      }}
      className="self-start text-sm font-medium text-primary underline underline-offset-2"
    >
      {label}
    </button>
  );

  if (mode.kind === "picked") {
    const { club } = mode;
    return (
      <div className="flex min-w-0 flex-col gap-2 rounded-md border border-border bg-muted/40 p-3">
        <p className="text-sm text-muted-foreground">{t.picked}</p>
        <p className="font-semibold">{club.name}</p>
        {club.venue !== null && <p className="text-sm">{t.venue.replace("{venue}", club.venue)}</p>}
        <p className="text-sm">{addressLabel(club)}</p>
        <input type="hidden" name={names.name} value={club.name} />
        <input type="hidden" name={names.postalCode} value={club.postalCode} />
        <input type="hidden" name={names.street} value={club.street ?? ""} />
        <input type="hidden" name={names.number} value={club.number ?? ""} />
        <input type="hidden" name={names.city} value={club.city ?? ""} />
        <input type="hidden" name={names.venue} value={club.venue ?? ""} />
        {backToSearch(t.change)}
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {mode.notice !== null && (
        <p role="status" className="text-sm text-muted-foreground">
          {mode.notice}
        </p>
      )}
      <TextField
        id={`${idBase}-name`}
        name={names.name}
        label={labels.name}
        maxLength={255}
        uppercase
        defaultValue={mode.prefill?.name ?? valueOf(names.name)}
        error={errors.name}
      />
      <div className="md:max-w-xs">
        <TextField
          id={`${idBase}-postal-code`}
          name={names.postalCode}
          label={labels.postalCode}
          {...(labels.postalCodeHint === undefined ? {} : { hint: labels.postalCodeHint })}
          maxLength={10}
          defaultValue={mode.prefill?.postalCode ?? valueOf(names.postalCode)}
          error={errors.postalCode}
        />
      </div>
      {backToSearch(t.backToSearch)}
    </div>
  );
}
