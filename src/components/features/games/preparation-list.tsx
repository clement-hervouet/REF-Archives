/**
 * Matchs préparés (§15.4.10) : colonne de date, équipes (lien vers la préparation), niveau,
 * classement abrégé de chaque équipe (avec « déjà arbitrée ») et « Observé ». Les textes
 * restent sur la page de la préparation.
 */
import Link from "next/link";
import { MatchDate } from "@/components/features/compensations/match-date";
import { matchLevelLabel } from "@/components/features/scales/division-label";
import { fr } from "@/i18n/fr";
import { preparationPath } from "@/lib/app-paths";
import { toParisIsoDate } from "@/lib/dates";
import { formatIsoDate } from "@/lib/format";
import { withTeams } from "@/lib/match-teams";
import type { PreparationListItem } from "@/server/db/preparations";
import { standingText } from "./preparation-messages";

const t = fr.preparations;

/** Ligne d'une équipe : « BC BÉTHUNE : 3e sur 12, 7 V – 2 D, déjà arbitrée », ou `null`. */
function teamLine(
  name: string,
  standing: PreparationListItem["team1"],
  teamCount: number | null,
): string | null {
  const parts = [
    standingText(standing, teamCount),
    standing.alreadyRefereed ? t.alreadyRefereedShort : null,
  ]
    .filter((part) => part !== null)
    .join(t.standingSeparator);
  return parts === "" ? null : t.standing.replace("{team}", name).replace("{standing}", parts);
}

function PreparationCard({ item }: { item: PreparationListItem }) {
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
        <h2 className="font-semibold break-words">
          <Link
            href={preparationPath(item.gameId)}
            aria-label={`${teams}, ${t.openLabel.replace("{date}", date)}`}
            className="underline decoration-border underline-offset-4 after:absolute after:inset-0 after:rounded-md hover:decoration-foreground"
          >
            {teams}
          </Link>
        </h2>
        <p className="text-sm text-muted-foreground">{matchLevelLabel(item.division)}</p>
        {lines.map((line) => (
          <p key={line} className="text-sm break-words">
            {line}
          </p>
        ))}
      </div>

      {item.observed && (
        <div className="md:pt-0.5">
          <p className="inline-flex rounded-sm border border-primary px-2 py-0.5 text-sm font-medium">
            {t.observed}
          </p>
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
