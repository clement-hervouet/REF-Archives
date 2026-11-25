import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { addressLabel } from "@/components/features/compensations/address-label";
import { MatchDate } from "@/components/features/compensations/match-date";
import { ConfirmActionButton } from "@/components/features/games/confirm-action-button";
import { PreparationForm } from "@/components/features/games/preparation-form";
import { SharePanel } from "@/components/features/games/share-panel";
import {
  firstNameOf,
  fullNameOf,
  modifiedByText,
  namesList,
} from "@/components/features/games/shared-preparation-labels";
import { personLabel } from "@/components/features/games/person-label";
import { PageTitle } from "@/components/features/common/page-title";
import { matchLevelLabel } from "@/components/features/scales/division-label";
import { fr } from "@/i18n/fr";
import { gamePath } from "@/lib/app-paths";
import { toParisIsoDate } from "@/lib/dates";
import { withTeams } from "@/lib/match-teams";
import { seasonOf, seasonRange } from "@/lib/seasons";
import { requireUserOrRedirect } from "@/server/auth/session";
import { findGame } from "@/server/db/games";
import { getDb } from "@/server/db/pool";
import { findAlreadyRefereed, findPreparation } from "@/server/db/preparations";
import { listShareCandidates, listShareRecipients } from "@/server/db/shared-preparations";
import { preparationFormValues } from "@/server/games/preparation-form";
import { deletePreparationAction, savePreparationAction } from "../actions";
import { shareAction } from "../share-actions";

const t = fr.preparations;

// Type explicite plutôt que `PageProps` (généré par `next typegen`) : ESLint tourne en CI
// avant le typecheck, sur un clone sans `.next/types`.
type PreparationPageProps = { params: Promise<{ gameId: string }> };

export default async function PreparationPage(props: PreparationPageProps) {
  // Chaque page vérifie elle-même (§6.2) : le layout n'est pas rendu à chaque navigation.
  const user = await requireUserOrRedirect();
  const id = z.uuid().safeParse((await props.params).gameId);
  if (!id.success) {
    notFound();
  }
  const db = getDb();
  // Match d'un autre utilisateur ou supprimé : même réponse qu'un inexistant. Un plateau
  // n'a pas de préparation (§15.4.10).
  const game = await findGame(db, { gameId: id.data, userId: user.id });
  if (game === null || game.team2Name === null) {
    notFound();
  }
  // Saison FFBB du match (juillet → juin) : les matchs précédents se cherchent depuis son début.
  const seasonFrom = seasonRange(seasonOf(toParisIsoDate(game.startsAt).slice(0, 7))).from;
  const [preparation, alreadyRefereed, recipients, candidates] = await Promise.all([
    findPreparation(db, { gameId: game.id, userId: user.id }),
    findAlreadyRefereed(db, { gameId: game.id, userId: user.id, seasonFrom }),
    // L'utilisateur est le propriétaire du match (vérifié par `findGame`).
    listShareRecipients(db, { gameId: game.id, ownerUserId: user.id }),
    listShareCandidates(db, { gameId: game.id, ownerUserId: user.id }),
  ]);
  // Partage proposé aux arbitres dont la fiche a « a un compte » ou est déjà liée.
  const shareable = candidates.filter(
    (candidate) => candidate.hasAccount || candidate.linked !== null,
  );
  const people = new Map(recipients.map((recipient) => [recipient.userId, firstNameOf(recipient)]));
  const modifiedBy =
    preparation !== null && recipients.length > 0
      ? modifiedByText(preparation, user.id, people)
      : null;
  const sharedWith = namesList(recipients.map((recipient) => firstNameOf(recipient)));
  const initialValues = preparationFormValues(preparation, {
    alreadyRefereed: alreadyRefereed ?? { team1: false, team2: false },
    hasObserver: game.officials.observer !== null,
  });

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={gamePath(game.id)}
        className="inline-flex min-h-11 items-center self-start underline"
      >
        {t.form.back}
      </Link>

      <section className="grid gap-x-5 gap-y-3 rounded-md border border-border p-4 md:grid-cols-[5.5rem_minmax(0,1fr)]">
        <MatchDate startsAt={game.startsAt} />
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-sm text-muted-foreground">{t.form.title}</p>
          <PageTitle className="break-words">
            {withTeams(t.teams, game.team1Name, game.team2Name)}
          </PageTitle>
          <p className="break-words">
            {fr.games.detail.details
              .replace("{division}", matchLevelLabel(game.division))
              .replace("{address}", addressLabel(game.address))}
          </p>
        </div>
      </section>

      <p className="max-w-2xl text-muted-foreground">{t.form.intro}</p>
      {modifiedBy !== null && <p className="text-sm text-muted-foreground">{modifiedBy}</p>}

      {/* Clé : une préparation supprimée (ou recréée) repart de valeurs neuves. */}
      <PreparationForm
        key={preparation?.id ?? "none"}
        action={savePreparationAction}
        gameId={game.id}
        teamNames={{ team1: game.team1Name, team2: game.team2Name }}
        initialValues={initialValues}
        others={recipients.map((recipient) => ({
          key: recipient.userId,
          name: firstNameOf(recipient),
          checks: recipient.checks,
        }))}
      />

      <SharePanel
        gameId={game.id}
        action={shareAction}
        omitted={shareable.length < candidates.length}
        candidates={shareable.map((candidate) => ({
          personId: candidate.personId,
          name: personLabel(candidate),
          linkedName: candidate.linked === null ? null : fullNameOf(candidate.linked),
          shared: candidate.shared,
          pendingUntil: candidate.pendingUntil?.toISOString() ?? null,
        }))}
      />

      {preparation !== null && (
        <div className="border-t border-border pt-4">
          <ConfirmActionButton
            action={deletePreparationAction}
            hidden={{ name: "gameId", value: game.id }}
            labels={{
              submit: t.form.delete,
              warning:
                recipients.length > 0
                  ? fr.sharing.deleteWarning.replace("{names}", sharedWith)
                  : t.form.delete,
              confirm: fr.games.delete.confirm,
              cancel: fr.games.delete.cancel,
            }}
            messages={{ deleted: t.form.deleted, not_found: t.errors.gameNotFound }}
            successStatuses={["deleted"]}
          />
        </div>
      )}
    </div>
  );
}
