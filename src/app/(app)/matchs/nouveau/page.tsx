import Link from "next/link";
import { GameForm } from "@/components/features/games/game-form";
import { fr } from "@/i18n/fr";
import { GAME_NOTES_PATH } from "@/lib/app-paths";
import { requireUserOrRedirect } from "@/server/auth/session";
import { loadCompensationFormData } from "@/server/compensation/form-data";
import { listColleagues } from "@/server/db/persons";
import { getDb } from "@/server/db/pool";
import { DEFAULT_OFFICIALS_VALUES } from "@/server/games/officials-form";
import { createStandaloneGameAction } from "./actions";

const t = fr.games.standalone;

export default async function NewGamePage() {
  // Chaque page vérifie elle-même (§6.2) : le layout n'est pas rendu à chaque navigation.
  const user = await requireUserOrRedirect();
  const db = getDb();
  const [data, colleagues] = await Promise.all([
    loadCompensationFormData(db, user.id),
    listColleagues(db, user.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <section className="flex max-w-2xl flex-col gap-2">
        <Link
          href={GAME_NOTES_PATH}
          className="inline-flex min-h-11 items-center self-start underline"
        >
          {t.back}
        </Link>
        <h1 className="text-2xl font-semibold">{t.title}</h1>
        <p className="text-muted-foreground">{t.intro}</p>
      </section>
      <GameForm
        mode="create"
        action={createStandaloneGameAction}
        data={data}
        colleagues={colleagues}
        initialValues={DEFAULT_OFFICIALS_VALUES}
        labels={{ submit: t.submit, submitting: t.submitting }}
      />
    </div>
  );
}
