/**
 * Autres salles d'un club choisi dans l'annuaire FFBB (celles où il reçoit cette saison),
 * listées sous sa salle principale avant l'enregistrement.
 */
import { venueLabel } from "@/components/features/compensations/address-label";
import { fr } from "@/i18n/fr";
import type { ClubVenue } from "@/lib/schemas/compensations";

const t = fr.clubs.ffbb;

export function OtherVenues({ venues }: { venues: readonly ClubVenue[] }) {
  if (venues.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-col gap-1 text-sm">
      <p>
        {venues.length === 1
          ? t.otherVenuesOne
          : t.otherVenuesMany.replace("{count}", String(venues.length))}
      </p>
      <ul className="flex list-disc flex-col gap-0.5 pl-5">
        {venues.map((venue, index) => (
          // Liste figée (club choisi) : l'ordre suffit comme clé.
          <li key={index} className="break-words">
            {venueLabel(venue)}
          </li>
        ))}
      </ul>
    </div>
  );
}
