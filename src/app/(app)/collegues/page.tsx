import { Disclosure } from "@/components/features/common/disclosure";
import { ColleagueCard } from "@/components/features/games/colleague-card";
import { ColleagueDirectory } from "@/components/features/games/colleague-directory";
import { ColleagueForm } from "@/components/features/games/colleague-form";
import { colleagueSearchText } from "@/components/features/games/colleague-search";
import { personLabel } from "@/components/features/games/person-label";
import { fr } from "@/i18n/fr";
import { requireUserOrRedirect } from "@/server/auth/session";
import { listClubs } from "@/server/db/clubs";
import { listColleagues } from "@/server/db/persons";
import { getDb } from "@/server/db/pool";
import { createColleagueAction, deleteColleagueAction, updateColleagueAction } from "./actions";

const t = fr.colleagues;

export default async function ColleaguesPage() {
  // Chaque page vérifie elle-même (§6.2) : le layout n'est pas rendu à chaque navigation.
  const user = await requireUserOrRedirect();
  const db = getDb();
  const [colleagues, clubList] = await Promise.all([
    listColleagues(db, user.id),
    listClubs(db, user.id),
  ]);
  const clubs = clubList.map((club) => ({
    id: club.id,
    name: club.name,
    city: club.address.city,
  }));

  return (
    <div className="flex flex-col gap-6">
      <section className="flex max-w-2xl flex-col gap-2">
        <h1 className="text-2xl font-semibold">{t.title}</h1>
        <p className="text-muted-foreground">{t.intro}</p>
      </section>

      {/* Ouvert d'office tant qu'il n'y a aucun collègue. */}
      <Disclosure summary={t.add.legend} open={colleagues.length === 0}>
        <ColleagueForm
          action={createColleagueAction}
          clubs={clubs}
          labels={{ submit: t.add.submit, submitting: t.add.submitting }}
        />
      </Disclosure>

      {colleagues.length === 0 ? (
        <p className="text-muted-foreground">{t.empty}</p>
      ) : (
        <ColleagueDirectory
          entries={colleagues.map((colleague) => {
            const name = personLabel(colleague);
            return {
              id: colleague.id,
              searchText: colleagueSearchText({
                firstname: colleague.firstname,
                lastname: colleague.lastname,
                clubName: colleague.club?.name ?? null,
              }),
              card: (
                <ColleagueCard
                  colleague={colleague}
                  name={name}
                  clubs={clubs}
                  updateAction={updateColleagueAction}
                  deleteAction={deleteColleagueAction}
                />
              ),
            };
          })}
        />
      )}
    </div>
  );
}
