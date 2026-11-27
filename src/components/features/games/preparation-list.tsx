/**
 * Matchs préparés (§15.4.10) : colonne de date, équipes (lien vers la préparation), niveau,
 * classement abrégé de chaque équipe et « Observé ». Le reste (« déjà arbitrée », textes)
 * est sur la page de la préparation.
 */
import { MatchClubBadges } from "@/components/features/clubs/club-badge";
import Link from "next/link";
import { MatchDate } from "@/components/features/compensations/match-date";
import { matchLevelLabel } from "@/components/features/scales/division-label";
import { fr } from "@/i18n/fr";
import { preparationPath, sharedPreparationPath } from "@/lib/app-paths";
import { toParisIsoDate } from "@/lib/dates";
import { formatIsoDate } from "@/lib/format";
import { withTeams } from "@/lib/match-teams";
import type { PreparationListItem } from "@/server/db/preparations";
import { standingText } from "./preparation-messages";
import { fullNameOf } from "./shared-preparation-labels";

const t = fr.preparations;

/** Ligne d'une équipe : « BC BÉTHUNE : 3e sur 12, 7 V – 2 D », ou `null`. */
function teamLine(
  name: string,
  standing: PreparationListItem["team1"],
  teamCount: number | null,
): string | null {
  const text = standingText(standing, teamCount);
  return text === null ? null : t.standing.replace("{team}", name).replace("{standing}", text);
}

function PreparationCard({ item }: { item: PreparationListItem }) {
  // Préparation partagée par un collègue : elle s'ouvre sur la page du destinataire.
  const href =
    item.sharedBy === null ? preparationPath(item.gameId) : sharedPreparationPath(item.gameId);
  const date = formatIsoDate(toParisIsoDate(item.startsAt));
  const teams = withTeams(t.teams, item.team1Name, item.team2Name);
  const lines = [
    teamLine(item.team1Name, item.team1, item.teamCount),
    item.team2Name === null ? null : teamLine(item.team2Name, item.team2, item.teamCount),
  ].filter((line) => line !== null);
  return (
    // `relative` : le lien du titre couvre toute la carte (cible tactile, bloc 13).
    <article className="relative grid gap-x-5 gap-y-3 rounded-md border border-border p-4 md:grid-cols-[5.5rem_minmax(0,1fr)_auto]">
      <MatchDate startsAt={item.startsAt} />

      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex items-center gap-3">
          <MatchClubBadges team1={item.team1Club} team2={item.team2Club} />
          <h2 className="min-w-0 font-semibold break-words">
            <Link
              href={href}
              aria-label={`${teams}, ${t.openLabel.replace("{date}", date)}`}
              className="underline decoration-border underline-offset-4 after:absolute after:inset-0 after:rounded-md hover:decoration-foreground"
            >
              {teams}
            </Link>
          </h2>
        </div>
        <p className="text-sm text-muted-foreground">{matchLevelLabel(item.division)}</p>
        {item.sharedBy !== null && (
          <p className="text-sm text-muted-foreground">
            {fr.sharing.sharedWithMe.by.replace("{name}", fullNameOf(item.sharedBy))}
          </p>
        )}
        {lines.map((line) => (
          <p key={line} className="text-sm break-words">
            {line}
          </p>
        ))}
      </div>

      {(item.observed || (item.shared && item.sharedBy === null)) && (
        <div className="flex flex-wrap gap-2 md:flex-col md:items-end md:pt-0.5">
          {item.observed && (
            <p className="inline-flex rounded-sm border border-primary px-2 py-0.5 text-sm font-medium">
              {t.observed}
            </p>
          )}
          {item.shared && item.sharedBy === null && (
            <p className="inline-flex rounded-sm border border-border px-2 py-0.5 text-sm font-medium">
              {fr.sharing.sharedBadge}
            </p>
          )}
        </div>
      )}
    </article>
  );
}

export function PreparationList({ items }: { items: readonly PreparationListItem[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <li key={item.gameId}>
          <PreparationCard item={item} />
        </li>
      ))}
    </ul>
  );
}
