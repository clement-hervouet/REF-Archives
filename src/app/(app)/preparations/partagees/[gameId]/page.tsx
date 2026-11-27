import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { MatchClubBadges } from "@/components/features/clubs/club-badge";
import { addressLabel } from "@/components/features/compensations/address-label";
import { MatchDate } from "@/components/features/compensations/match-date";
import { ConfirmActionButton } from "@/components/features/games/confirm-action-button";
import { PreparationForm } from "@/components/features/games/preparation-form";
import {
  firstNameOf,
  fullNameOf,
  modifiedByText,
} from "@/components/features/games/shared-preparation-labels";
import { PageTitle } from "@/components/features/common/page-title";
import { matchLevelLabel } from "@/components/features/scales/division-label";
import { fr } from "@/i18n/fr";
import { SHARED_PREPARATIONS_PATH } from "@/lib/app-paths";
import { withTeams } from "@/lib/match-teams";
import { requireUserOrRedirect } from "@/server/auth/session";
import { getDb } from "@/server/db/pool";
import {
  findRecipientGame,
  findRecipientPreparation,
  listShareRecipients,
} from "@/server/db/shared-preparations";
import { preparationFormValues } from "@/server/games/preparation-form";
import { recipientFormValues } from "@/server/sharing/recipient-preparation";
import { leaveShareAction, saveSharedPreparationAction } from "../../share-actions";

const t = fr.preparations;
const ts = fr.sharing;

// Type explicite plutôt que `PageProps` (généré par `next typegen`) : ESLint tourne en CI
// avant le typecheck, sur un clone sans `.next/types`.
type SharedPreparationPageProps = { params: Promise<{ gameId: string }> };

/**
 * Préparation d'un match partagé par un collègue (migration 035) : le match en lecture
 * seule, la préparation commune modifiable, et la case « déjà arbitrée » du destinataire.
 */
export default async function SharedPreparationPage(props: SharedPreparationPageProps) {
  // Chaque page vérifie elle-même (§6.2) : le layout n'est pas rendu à chaque navigation.
  const user = await requireUserOrRedirect();
  const id = z.uuid().safeParse((await props.params).gameId);
  if (!id.success) {
    notFound();
  }
  const db = getDb();
  // Sans partage valide (jamais partagé, retiré, délié, match supprimé…) : même réponse
  // qu'un match inexistant.
  const game = await findRecipientGame(db, { gameId: id.data, viewerId: user.id });
  if (game === null || game.team2Name === null) {
    notFound();
  }
  const [preparation, recipients] = await Promise.all([
    findRecipientPreparation(db, { gameId: game.id, viewerId: user.id }),
    // Accès vérifié juste au-dessus (`findRecipientGame`).
    listShareRecipients(db, { gameId: game.id, ownerUserId: game.owner.userId }),
  ]);
  const ownerFirstName = firstNameOf(game.owner);
  const ownerName = fullNameOf(game.owner);
  const initialValues =
    preparation === null
      ? preparationFormValues(null, { alreadyRefereed: game.checks, hasObserver: game.hasObserver })
      : recipientFormValues(preparation, game.checks);
  // Les cases des autres : le propriétaire (celles de sa préparation), puis les autres
  // destinataires.
  const others = [
    {
      key: game.owner.userId,
      name: ownerFirstName,
      checks: {
        team1: preparation?.team1.alreadyRefereed ?? false,
        team2: preparation?.team2.alreadyRefereed ?? false,
      },
    },
    ...recipients
      .filter((recipient) => recipient.userId !== user.id)
      .map((recipient) => ({
        key: recipient.userId,
        name: firstNameOf(recipient),
        checks: recipient.checks,
      })),
  ];
  const people = new Map([
    [game.owner.userId, ownerFirstName],
    ...recipients.map((recipient): [string, string] => [recipient.userId, firstNameOf(recipient)]),
  ]);
  const modifiedBy = preparation === null ? null : modifiedByText(preparation, user.id, people);

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={SHARED_PREPARATIONS_PATH}
        className="inline-flex min-h-11 items-center self-start underline"
      >
        {ts.recipient.back}
      </Link>

      <section className="grid gap-x-5 gap-y-3 rounded-md border border-border p-4 md:grid-cols-[5.5rem_minmax(0,1fr)]">
        <MatchDate startsAt={game.startsAt} />
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-sm text-muted-foreground">
            {ts.recipient.sharedBy.replace("{name}", ownerName)}
          </p>
          <div className="flex items-center gap-3">
            <MatchClubBadges team1={game.team1Club} team2={game.team2Club} />
            <PageTitle className="min-w-0 break-words">
              {withTeams(t.teams, game.team1Name, game.team2Name)}
            </PageTitle>
          </div>
          <p className="break-words">
            {fr.games.detail.details
              .replace("{division}", matchLevelLabel(game.division))
              .replace("{address}", addressLabel(game.address))}
          </p>
        </div>
      </section>

      <p className="max-w-2xl text-muted-foreground">
        {ts.recipient.intro.replaceAll("{name}", ownerFirstName)}
      </p>
      {modifiedBy !== null && <p className="text-sm text-muted-foreground">{modifiedBy}</p>}

      {/* Clé : une préparation supprimée (ou recréée) repart de valeurs neuves. */}
      <PreparationForm
        key={preparation?.id ?? "none"}
        action={saveSharedPreparationAction}
        gameId={game.id}
        teamNames={{ team1: game.team1Name, team2: game.team2Name }}
        initialValues={initialValues}
        others={others}
      />

      <div className="border-t border-border pt-4">
        <ConfirmActionButton
          action={leaveShareAction}
          hidden={{ name: "gameId", value: game.id }}
          labels={{
            submit: ts.recipient.leave,
            warning: ts.recipient.leaveWarning.replace("{name}", ownerFirstName),
            confirm: ts.recipient.leaveConfirm,
            cancel: ts.recipient.leaveCancel,
          }}
          messages={{ not_found: t.errors.gameNotFound }}
        />
      </div>
    </div>
  );
}
