import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { OfficialsForm } from "@/components/features/games/officials-form";
import { fr } from "@/i18n/fr";
import { gamePath } from "@/lib/app-paths";
import { toParisIsoDate } from "@/lib/dates";
import { formatIsoDate } from "@/lib/format";
import { toParisTimeOfDay } from "@/lib/paris-time";
import { requireUserOrRedirect } from "@/server/auth/session";
import { findCompensationForGame } from "@/server/db/games";
import { listColleagues } from "@/server/db/persons";
import { getDb } from "@/server/db/pool";
import { DEFAULT_OFFICIALS_VALUES } from "@/server/games/officials-form";
import { createGameAction } from "./actions";

const t = fr.games;

// Type explicite plutôt que `PageProps` (généré par `next typegen`) : ESLint tourne en CI
// avant le typecheck, sur un clone sans `.next/types`.
type CompleteGamePageProps = { params: Promise<{ id: string }> };

export default async function CompleteGamePage(props: CompleteGamePageProps) {
  // Chaque page vérifie elle-même (§6.2) : le layout n'est pas rendu à chaque navigation.
  const user = await requireUserOrRedirect();
  const id = z.uuid().safeParse((await props.params).id);
  if (!id.success) {
    notFound();
  }
  const db = getDb();
  // Indemnité d'un autre utilisateur ou supprimée : même réponse qu'une inexistante.
  const compensation = await findCompensationForGame(db, {
    compensationId: id.data,
    userId: user.id,
  });
  if (compensation === null) {
    notFound();
  }
  if (compensation.gameId !== null) {
    redirect(gamePath(compensation.gameId));
  }
  const colleagues = await listColleagues(db, user.id);

  return (
    <div className="flex flex-col gap-6">
      <section className="flex max-w-2xl flex-col gap-2">
        <Link href="/indemnites" className="inline-flex min-h-11 items-center self-start underline">
          {t.complete.back}
        </Link>
        <h1 className="text-2xl font-semibold">{t.complete.title}</h1>
        <p className="font-medium break-words">
          {t.complete.matchOf
            .replace(
              "{teams}",
              t.detail.title
                .replace("{team1}", compensation.team1Name)
                .replace("{team2}", compensation.team2Name),
            )
            .replace("{date}", formatIsoDate(toParisIsoDate(compensation.startsAt)))
            .replace("{time}", toParisTimeOfDay(compensation.startsAt))}
        </p>
        <p className="text-neutral-700">{t.complete.intro}</p>
      </section>
      <OfficialsForm
        action={createGameAction}
        colleagues={colleagues}
        initialValues={DEFAULT_OFFICIALS_VALUES}
        hidden={{ name: "compensationId", value: compensation.id }}
        labels={{ submit: t.complete.submit, submitting: t.complete.submitting }}
      />
    </div>
  );
}
