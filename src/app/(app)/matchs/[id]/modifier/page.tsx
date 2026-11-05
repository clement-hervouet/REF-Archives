import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { GameForm } from "@/components/features/games/game-form";
import { fr } from "@/i18n/fr";
import { gamePath } from "@/lib/app-paths";
import { requireUserOrRedirect } from "@/server/auth/session";
import { loadCompensationFormData } from "@/server/compensation/form-data";
import { findGameForEdit } from "@/server/db/games";
import { getDb } from "@/server/db/pool";
import { gameInfoFormValues } from "@/server/games/game-info-form";
import { updateGameInfoAction } from "./actions";

const t = fr.games.info;

// Type explicite plutôt que `PageProps` (généré par `next typegen`) : ESLint tourne en CI
// avant le typecheck, sur un clone sans `.next/types`.
type EditGamePageProps = { params: Promise<{ id: string }> };

export default async function EditGamePage(props: EditGamePageProps) {
  // Chaque page vérifie elle-même (§6.2) : le layout n'est pas rendu à chaque navigation.
  const user = await requireUserOrRedirect();
  const id = z.uuid().safeParse((await props.params).id);
  if (!id.success) {
    notFound();
  }
  const db = getDb();
  // Match d'un autre utilisateur ou supprimé : même réponse qu'un inexistant.
  const game = await findGameForEdit(db, { gameId: id.data, userId: user.id });
  if (game === null) {
    notFound();
  }
  const data = await loadCompensationFormData(db, user.id);

  return (
    <div className="flex flex-col gap-6">
      <section className="flex max-w-2xl flex-col gap-2">
        <Link
          href={gamePath(game.id)}
          className="inline-flex min-h-11 items-center self-start underline"
        >
          {t.back}
        </Link>
        <h1 className="text-2xl font-semibold">{t.title}</h1>
        <p className="text-neutral-700">
          {game.compensationId === null ? t.introAlone : t.introLinked}
        </p>
      </section>
      <GameForm
        mode="edit"
        gameId={game.id}
        action={updateGameInfoAction}
        data={data}
        initialValues={gameInfoFormValues(game)}
        labels={{ submit: t.submit, submitting: t.submitting }}
      />
    </div>
  );
}
