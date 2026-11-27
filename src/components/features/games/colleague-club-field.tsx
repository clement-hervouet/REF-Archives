"use client";

/**
 * Club d'un collègue (bloc 10) : aucun, un club existant, ou « Nouveau club… » (mêmes
 * règles que dans une indemnité, §15.4.1) : recherche dans l'annuaire FFBB par ville, ou à
 * défaut nom et code postal saisis, le reste de l'adresse se complétant dans « Clubs ».
 * Rendu dans le `<form>` remonté après chaque envoi : le choix repart des valeurs
 * conservées.
 */
import { useState } from "react";
import { NewClubFields } from "@/components/features/clubs/new-club-fields";
import { FIELD_CLASS } from "@/components/features/scales/form-parts";
import { fr } from "@/i18n/fr";
import { NEW_CHOICE } from "@/lib/compensation-form-fields";
import { cn } from "@/lib/utils";
import type { ColleagueFormState } from "@/server/games/colleagues-form";
import { newClubFieldError } from "./game-messages";

const c = fr.colleagues.club;
const f = fr.compensations.fields;

/** `place` : ville du club, sinon son code postal (distingue deux clubs du même nom). */
export type ClubOption = { id: string; name: string; place: string };

type Props = {
  idBase: string;
  clubs: readonly ClubOption[];
  valueOf: (name: string) => string;
  state: ColleagueFormState;
  inline: boolean;
};

const INPUT_NAMES = {
  name: "clubName",
  postalCode: "clubPostalCode",
  street: "clubStreet",
  number: "clubNumber",
  city: "clubCity",
  venue: "clubVenue",
  venues: "clubVenues",
  ffbb: "clubFfbb",
};

export function ColleagueClubField({ idBase, clubs, valueOf, state, inline }: Props) {
  const [choice, setChoice] = useState(valueOf("clubId"));

  return (
    <>
      <div className={cn("flex min-w-0 flex-col gap-1", inline && "md:w-60")}>
        <label htmlFor={`${idBase}-club`} className="text-sm font-medium">
          {c.label}
        </label>
        <select
          id={`${idBase}-club`}
          name="clubId"
          value={choice}
          onChange={(event) => {
            setChoice(event.target.value);
          }}
          aria-describedby={clubs.length === 0 ? `${idBase}-club-hint` : undefined}
          className={FIELD_CLASS}
        >
          <option value="">{c.none}</option>
          {clubs.map((club) => (
            // La ville distingue deux clubs du même nom.
            <option key={club.id} value={club.id}>
              {club.name} ({club.place})
            </option>
          ))}
          <option value={NEW_CHOICE}>{c.new}</option>
        </select>
        {clubs.length === 0 && (
          <p id={`${idBase}-club-hint`} className="text-sm text-muted-foreground">
            {c.hint}
          </p>
        )}
      </div>
      {choice === NEW_CHOICE && (
        <fieldset className="flex min-w-0 flex-col gap-3 rounded-md border border-border p-3 md:basis-full">
          <legend className="px-1 text-sm font-semibold">{c.newLegend}</legend>
          <NewClubFields
            idBase={`${idBase}-club`}
            names={INPUT_NAMES}
            labels={{ name: f.clubName, postalCode: f.postalCode }}
            valueOf={valueOf}
            errors={{
              name: newClubFieldError("name", state),
              postalCode: newClubFieldError("postalCode", state),
            }}
          />
        </fieldset>
      )}
    </>
  );
}
