/**
 * Matchs notés (blocs 9 et 10) : colonne de date, équipes (lien vers la fiche), niveau,
 * place occupée, extrait du texte, nombre de clips, et les échelles renseignées en couleur
 * (avec le chiffre). Les liens des clips restent sur la fiche du match.
 */
import Link from "next/link";
import { MatchDate } from "@/components/features/compensations/match-date";
import { divisionLabel } from "@/components/features/scales/division-label";
import { fr } from "@/i18n/fr";
import { NOTE_LEVEL_FIELDS } from "@/lib/game-form-fields";
import { gamePath } from "@/lib/app-paths";
import { toParisIsoDate } from "@/lib/dates";
import { formatIsoDate } from "@/lib/format";
import type { GameNoteListItem } from "@/server/db/game-notes";
import { LevelMeter } from "./level-meter";

const t = fr.gameNotes;

function clipsLabel(count: number): string | null {
  if (count === 0) return null;
  return count === 1 ? t.clipsOne : t.clipsMany.replace("{count}", String(count));
}

function GameNoteCard({ item }: { item: GameNoteListItem }) {
  const date = formatIsoDate(toParisIsoDate(item.startsAt));
  const clips = clipsLabel(item.clipCount);
  const levels = NOTE_LEVEL_FIELDS.flatMap((field) => {
    const value = item[field];
    return value === null ? [] : [{ field, value }];
  });
  return (
    // `relative` : le lien du titre couvre toute la carte (cible tactile, bloc 13).
    <article className="relative grid gap-x-5 gap-y-3 rounded-md border border-border p-4 md:grid-cols-[5.5rem_minmax(0,1fr)_auto]">
      <MatchDate startsAt={item.startsAt} />

      <div className="flex min-w-0 flex-col gap-1">
        <h2 className="font-semibold break-words">
          <Link
            href={gamePath(item.gameId)}
            aria-label={`${t.teams.replace("{team1}", item.team1Name).replace("{team2}", item.team2Name)}, ${t.openLabel.replace("{date}", date)}`}
            className="underline decoration-border underline-offset-4 after:absolute after:inset-0 after:rounded-md hover:decoration-foreground"
          >
            {t.teams.replace("{team1}", item.team1Name).replace("{team2}", item.team2Name)}
          </Link>
        </h2>
        <p className="text-sm text-muted-foreground">
          {divisionLabel(item.division)}
          {item.selfSlot !== null && (
            <> · {t.selfSlot.replace("{slot}", fr.games.slots[item.selfSlot])}</>
          )}
        </p>
        {!item.hasNote && <p className="text-sm text-muted-foreground">{t.noNote}</p>}
        {item.excerpt !== null && (
          <p className="text-sm break-words whitespace-pre-line">
            {item.excerptTruncated ? `${item.excerpt}…` : item.excerpt}
          </p>
        )}
        {clips !== null && <p className="text-sm text-muted-foreground">{clips}</p>}
      </div>

      {levels.length > 0 && (
        <div className="flex flex-col gap-1.5 md:items-end md:pt-0.5">
          {levels.map(({ field, value }) => (
            <LevelMeter key={field} kind={field} value={value} />
          ))}
        </div>
      )}
    </article>
  );
}

export function GameNoteList({ items }: { items: readonly GameNoteListItem[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <li key={item.gameId}>
          <GameNoteCard item={item} />
        </li>
      ))}
    </ul>
  );
}
