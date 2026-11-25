import { ClubCard } from "@/components/features/clubs/club-card";
import { ClubForm } from "@/components/features/clubs/club-form";
import { Disclosure } from "@/components/features/common/disclosure";
import { PageTitle } from "@/components/features/common/page-title";
import { SearchableList } from "@/components/features/common/searchable-list";
import { fr } from "@/i18n/fr";
import { searchText } from "@/lib/search";
import { requireUserOrRedirect } from "@/server/auth/session";
import { listClubs } from "@/server/db/clubs";
import { getDb } from "@/server/db/pool";
import {
  addClubVenuesAction,
  createClubAction,
  deleteClubAction,
  removeClubVenueAction,
  setMainClubVenueAction,
  updateClubAction,
} from "./actions";

const t = fr.clubs;

/** Page « Mes clubs » (§15.4.1) : sur le modèle de « Mes collègues » (cartes, recherche). */
export default async function ClubsPage() {
  // Chaque page vérifie elle-même (§6.2) : le layout n'est pas rendu à chaque navigation.
  const user = await requireUserOrRedirect();
  const clubs = await listClubs(getDb(), user.id);

  return (
    <div className="flex flex-col gap-6">
      <section className="flex max-w-2xl flex-col gap-2">
        <PageTitle>{t.title}</PageTitle>
        <p className="text-muted-foreground">{t.intro}</p>
      </section>

      {/* Ouvert d'office tant qu'il n'y a aucun club. */}
      <Disclosure summary={t.add.legend} open={clubs.length === 0}>
        <ClubForm
          action={createClubAction}
          labels={{ submit: t.add.submit, submitting: t.add.submitting }}
        />
      </Disclosure>

      {clubs.length === 0 ? (
        <p className="text-muted-foreground">{t.empty}</p>
      ) : (
        <SearchableList
          labels={t.search}
          layout="grid"
          entries={clubs.map((club) => ({
            id: club.id,
            searchText: searchText([
              club.name,
              ...[club.address, ...club.venues].flatMap((venue) => [
                venue.name,
                venue.city,
                venue.postalCode,
                venue.street,
              ]),
            ]),
            card: (
              <ClubCard
                club={club}
                updateAction={updateClubAction}
                deleteAction={deleteClubAction}
                venueActions={{
                  add: addClubVenuesAction,
                  remove: removeClubVenueAction,
                  setMain: setMainClubVenueAction,
                }}
              />
            ),
          }))}
        />
      )}
    </div>
  );
}
