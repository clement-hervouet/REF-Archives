"use client";

/**
 * Recherche d'un club dans l'annuaire FFBB : on saisit la ville, la liste des clubs qui y
 * sont domiciliés s'affiche, et le club choisi arrive avec l'adresse de sa salle
 * principale (`onPick`). Panne de l'annuaire, ville sans club ou fiche illisible : retour à
 * la saisie manuelle (`onManual`, avec le message à afficher).
 *
 * Rendu aussi DANS un formulaire (indemnité, match, collègue) : pas de `<form>` imbriqué,
 * Entrée lance la recherche au lieu d'envoyer le formulaire, le champ ville n'a pas de
 * `name` (rien n'est envoyé) et les boutons sont de type `button`.
 */
import { useRef, useState } from "react";
import { getFfbbClubAction, searchFfbbClubsAction } from "@/app/(app)/clubs/ffbb-actions";
import { FIELD_CLASS, SECONDARY_BUTTON_CLASS } from "@/components/features/scales/form-parts";
import { fr } from "@/i18n/fr";
import type { FfbbClubDetails, FfbbClubHit } from "@/server/ffbb/ffbb-clubs";

const t = fr.clubs.ffbb;

type Props = {
  idBase: string;
  onPick: (club: FfbbClubDetails) => void;
  /** Saisie manuelle : demandée (`notice` nul) ou imposée par un échec (message). */
  onManual: (notice: string | null) => void;
  /** Erreur du formulaire englobant (aucun club choisi), affichée sous le champ. */
  error?: string | null;
};

type Status =
  | { kind: "idle" }
  | { kind: "searching" }
  | { kind: "results"; city: string; hits: readonly FfbbClubHit[]; loadingId: string | null };

const MIN_CITY_LENGTH = 2;

function countLabel(count: number, city: string): string {
  const template = count === 1 ? t.countOne : t.countMany;
  return template.replace("{count}", String(count)).replace("{city}", city);
}

function placeOf(hit: FfbbClubHit): string | null {
  const parts = [hit.postalCode, hit.city].filter((part) => part !== null);
  return parts.length === 0 ? null : parts.join(" ");
}

export function FfbbClubSearch({ idBase, onPick, onManual, error = null }: Props) {
  const [city, setCity] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  // Seule la dernière requête compte : une réponse plus ancienne est ignorée.
  const request = useRef(0);
  const inputId = `${idBase}-ffbb-city`;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;

  async function search() {
    const query = city.trim();
    if (query.length < MIN_CITY_LENGTH || status.kind === "searching") {
      return;
    }
    const current = ++request.current;
    setStatus({ kind: "searching" });
    let result: Awaited<ReturnType<typeof searchFfbbClubsAction>>;
    try {
      result = await searchFfbbClubsAction(query);
    } catch {
      result = { ok: false };
    }
    if (current !== request.current) {
      return;
    }
    if (!result.ok) {
      setStatus({ kind: "idle" });
      onManual(t.unavailable);
    } else if (result.value.length === 0) {
      setStatus({ kind: "idle" });
      onManual(t.empty.replace("{city}", query));
    } else {
      setStatus({ kind: "results", city: query, hits: result.value, loadingId: null });
    }
  }

  async function pick(hit: FfbbClubHit) {
    if (status.kind !== "results" || status.loadingId !== null) {
      return;
    }
    const current = ++request.current;
    setStatus({ ...status, loadingId: hit.id });
    let result: Awaited<ReturnType<typeof getFfbbClubAction>>;
    try {
      result = await getFfbbClubAction(hit.id);
    } catch {
      result = { ok: false };
    }
    if (current !== request.current) {
      return;
    }
    setStatus({ ...status, loadingId: null });
    if (result.ok) {
      onPick(result.value);
    } else {
      onManual(t.clubUnavailable);
    }
  }

  const searching = status.kind === "searching";
  const describedBy = [hintId, error === null ? null : errorId].filter(Boolean).join(" ");

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor={inputId} className="text-sm font-medium">
          {t.cityLabel}
        </label>
        <div className="flex gap-2">
          <input
            id={inputId}
            type="text"
            value={city}
            maxLength={100}
            autoComplete="address-level2"
            aria-describedby={describedBy}
            aria-invalid={error !== null}
            onChange={(event) => {
              setCity(event.target.value);
            }}
            onKeyDown={(event) => {
              // Dans un formulaire, Entrée l'enverrait : ici, elle lance la recherche.
              if (event.key === "Enter") {
                event.preventDefault();
                void search();
              }
            }}
            className={FIELD_CLASS}
          />
          <button
            type="button"
            onClick={() => {
              void search();
            }}
            disabled={searching || city.trim().length < MIN_CITY_LENGTH}
            className={`${SECONDARY_BUTTON_CLASS} shrink-0`}
          >
            {searching ? t.searching : t.search}
          </button>
        </div>
        <p id={hintId} className="text-sm text-muted-foreground">
          {t.cityHint}
        </p>
        {error !== null && (
          <p id={errorId} className="text-sm font-medium text-destructive">
            {error}
          </p>
        )}
      </div>

      <p role="status" className="sr-only">
        {searching
          ? t.searching
          : status.kind === "results"
            ? countLabel(status.hits.length, status.city)
            : ""}
      </p>

      {status.kind === "results" && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium" aria-hidden="true">
            {countLabel(status.hits.length, status.city)}
          </p>
          <ul className="flex max-h-80 flex-col gap-1 overflow-y-auto rounded-md border border-border p-1">
            {status.hits.map((hit) => {
              const place = placeOf(hit);
              const loading = status.loadingId === hit.id;
              return (
                <li key={hit.id}>
                  <button
                    type="button"
                    onClick={() => {
                      void pick(hit);
                    }}
                    disabled={status.loadingId !== null}
                    aria-busy={loading}
                    className="flex min-h-11 w-full flex-col items-start gap-0.5 rounded px-3 py-2 text-left hover:bg-muted focus-visible:bg-muted disabled:opacity-60"
                  >
                    <span className="flex flex-wrap items-center gap-2 font-medium">
                      {hit.name}
                      {hit.kind !== "club" && (
                        <span className="rounded border border-border px-1.5 text-xs font-normal text-muted-foreground">
                          {t.kinds[hit.kind]}
                        </span>
                      )}
                    </span>
                    {(place !== null || loading) && (
                      <span className="text-sm text-muted-foreground">
                        {loading ? t.loading : place}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          request.current++;
          setStatus({ kind: "idle" });
          onManual(null);
        }}
        className="self-start text-sm font-medium text-primary underline underline-offset-2"
      >
        {t.manual}
      </button>
    </div>
  );
}
