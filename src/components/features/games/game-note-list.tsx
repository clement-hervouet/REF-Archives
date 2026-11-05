/**
 * Matchs notés : date, équipes, niveau, place occupée, confiance, stress, extrait du
 * texte et nombre de clips. Des cartes plutôt qu'un tableau : lisibles à 375 px.
 * Les liens des clips ne sont affichés que sur la fiche du match.
 */
import Link from "next/link";
import { divisionLabel } from "@/components/features/scales/division-label";
import { fr } from "@/i18n/fr";
import { gamePath } from "@/lib/app-paths";
import { toParisIsoDate } from "@/lib/dates";
import { formatIsoDate } from "@/lib/format";
import { toParisTimeOfDay } from "@/lib/paris-time";
import type { GameNoteListItem } from "@/server/db/game-notes";

const t = fr.gameNotes;

export function GameNoteList({ items }: { items: readonly GameNoteListItem[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => {
        const date = formatIsoDate(toParisIsoDate(item.startsAt));
        const facts = [
          item.selfSlot === null
            ? null
            : t.selfSlot.replace("{slot}", fr.games.slots[item.selfSlot]),
          item.confidence === null
            ? null
            : t.confidence.replace("{value}", String(item.confidence)),
          item.stress === null ? null : t.stress.replace("{value}", String(item.stress)),
          item.clipCount === 0 ? null : t.clips.replace("{count}", String(item.clipCount)),
        ].filter((fact) => fact !== null);
        return (
          <li key={item.gameId}>
            <article className="flex flex-col gap-2 rounded-md border border-neutral-300 p-4">
              <p className="text-sm text-neutral-700">
                {t.when.replace("{date}", date).replace("{time}", toParisTimeOfDay(item.startsAt))}
                {" · "}
                {divisionLabel(item.division)}
              </p>
              <h2 className="font-semibold break-words">
                {t.teams.replace("{team1}", item.team1Name).replace("{team2}", item.team2Name)}
              </h2>
              {facts.length > 0 && (
                <ul className="flex flex-wrap gap-2 text-sm">
                  {facts.map((fact) => (
                    <li key={fact} className="rounded-md bg-neutral-100 px-2 py-1">
                      {fact}
                    </li>
                  ))}
                </ul>
              )}
              {item.excerpt !== null && (
                <p className="text-sm break-words whitespace-pre-line">
                  {item.excerptTruncated ? `${item.excerpt}…` : item.excerpt}
                </p>
              )}
              <Link
                href={gamePath(item.gameId)}
                aria-label={t.openLabel.replace("{date}", date)}
                className="inline-flex min-h-11 items-center self-start rounded-md border border-neutral-400 px-4"
              >
                {t.open}
              </Link>
            </article>
          </li>
        );
      })}
    </ul>
  );
}
