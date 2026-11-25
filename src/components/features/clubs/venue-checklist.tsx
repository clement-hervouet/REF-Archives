"use client";

/**
 * Salles importées de l'annuaire FFBB, à cocher. Au départ, seules celles de la ville du
 * club (`homeCity`) sont cochées : une salle d'une autre commune (tournoi, match
 * délocalisé) ne s'ajoute que si on la coche. Les cases n'ont pas de `name` : la sélection
 * part dans un seul champ caché (liste JSON), lu par le serveur comme une liste de salles.
 */
import { useId, useState } from "react";
import { venueLabel } from "@/components/features/compensations/address-label";
import { RADIO_INPUT_CLASS } from "@/components/features/scales/form-parts";
import { isSameCity } from "@/lib/places";
import type { ClubVenue } from "@/lib/schemas/compensations";

type Props = {
  venues: readonly ClubVenue[];
  /** Ville du club : ses salles sont cochées au départ. `null` : toutes le sont. */
  homeCity: string | null;
  /** Nom du champ caché envoyé. */
  name: string;
  legend: string;
  hint: string;
  /** Sélection modifiée (bouton d'envoi à activer ou non). */
  onChange?: (selected: readonly ClubVenue[]) => void;
};

/** Cases cochées au départ : les salles de la ville du club. */
export function checkedByDefault(venues: readonly ClubVenue[], homeCity: string | null): boolean[] {
  return venues.map((venue) => isSameCity(venue.city, homeCity));
}

export function VenueChecklist({ venues, homeCity, name, legend, hint, onChange }: Props) {
  const id = useId();
  const [checked, setChecked] = useState<readonly boolean[]>(() =>
    checkedByDefault(venues, homeCity),
  );
  const selected = venues.filter((_, index) => checked[index] === true);

  return (
    <fieldset className="flex min-w-0 flex-col gap-2" aria-describedby={`${id}-hint`}>
      <legend className="text-sm font-medium">{legend}</legend>
      <p id={`${id}-hint`} className="text-sm text-muted-foreground">
        {hint}
      </p>
      <ul className="flex flex-col gap-1">
        {venues.map((venue, index) => (
          // Liste figée (club choisi) : l'ordre suffit comme clé.
          <li key={index}>
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={checked[index] === true}
                onChange={(event) => {
                  const next = checked.map((value, position) =>
                    position === index ? event.target.checked : value,
                  );
                  setChecked(next);
                  onChange?.(venues.filter((_, position) => next[position] === true));
                }}
                className={RADIO_INPUT_CLASS}
              />
              <span className="min-w-0 break-words">{venueLabel(venue)}</span>
            </label>
          </li>
        ))}
      </ul>
      <input type="hidden" name={name} value={JSON.stringify(selected)} />
    </fieldset>
  );
}
