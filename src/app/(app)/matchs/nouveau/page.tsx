import Link from "next/link";
import { GameForm } from "@/components/features/games/game-form";
import { PageTitle } from "@/components/features/common/page-title";
import { fr } from "@/i18n/fr";
import { GAME_NOTES_PATH, NEW_GAME_NEXT_PREPARATION, PREPARATIONS_PATH } from "@/lib/app-paths";
import { requireUserOrRedirect } from "@/server/auth/session";
import { loadCompensationFormData } from "@/server/compensation/form-data";
import { listColleagues } from "@/server/db/persons";
import { getDb } from "@/server/db/pool";
import { DEFAULT_OFFICIALS_VALUES } from "@/server/games/officials-form";
import { createStandaloneGameAction, createStandaloneGameToPrepareAction } from "./actions";

const t = fr.games.standalone;

// Type explicite plutôt que `PageProps` (généré par `next typegen`) : ESLint tourne en CI
// avant le typecheck, sur un clone sans `.next/types`.
type NewGamePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function NewGamePage(props: NewGamePageProps) {
  // Chaque page vérifie elle-même (§6.2) : le layout n'est pas rendu à chaque navigation.
  const user = await requireUserOrRedirect();
  // `?suite=preparation` : on vient de « Préparation de match » (§15.4.10). Toute autre
  // valeur (ou une valeur répétée) garde le parcours des notes.
  const toPrepare = (await props.searchParams).suite === NEW_GAME_NEXT_PREPARATION;
  const db = getDb();
  const [data, colleagues] = await Promise.all([
    loadCompensationFormData(db, user.id),
    listColleagues(db, user.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <section className="flex max-w-2xl flex-col gap-2">
        <Link
          href={toPrepare ? PREPARATIONS_PATH : GAME_NOTES_PATH}
          className="inline-flex min-h-11 items-center self-start underline"
        >
          {toPrepare ? fr.preparations.newGame.back : t.back}
        </Link>
        <PageTitle>{t.title}</PageTitle>
        <p className="text-muted-foreground">{t.intro}</p>
      </section>
      <GameForm
        mode="create"
        action={toPrepare ? createStandaloneGameToPrepareAction : createStandaloneGameAction}
        data={data}
        colleagues={colleagues}
        initialValues={DEFAULT_OFFICIALS_VALUES}
        labels={{
          submit: toPrepare ? fr.preparations.newGame.submit : t.submit,
          submitting: t.submitting,
        }}
      />
    </div>
  );
}
