import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ConfirmActionButton } from "@/components/features/games/confirm-action-button";
import { NoteForm } from "@/components/features/games/note-form";
import { OfficialsForm } from "@/components/features/games/officials-form";
import { addressLabel } from "@/components/features/compensations/address-label";
import { MatchDate } from "@/components/features/compensations/match-date";
import { divisionLabel } from "@/components/features/scales/division-label";
import { fr } from "@/i18n/fr";
import { GAME_NOTES_PATH } from "@/lib/app-paths";
import { requireUserOrRedirect } from "@/server/auth/session";
import { findGame } from "@/server/db/games";
import { findNote } from "@/server/db/notes";
import { listColleagues } from "@/server/db/persons";
import { getDb } from "@/server/db/pool";
import { noteFormValues } from "@/server/games/note-form";
import { officialsFormValues } from "@/server/games/officials-form";
import {
  deleteGameAction,
  deleteNoteAction,
  saveNoteAction,
  updateOfficialsAction,
} from "./actions";

const t = fr.games;

const LINK_CLASS = "inline-flex min-h-11 items-center rounded-md border border-input px-4";

// Type explicite plutôt que `PageProps` (généré par `next typegen`) : ESLint tourne en CI
// avant le typecheck, sur un clone sans `.next/types`.
type GamePageProps = { params: Promise<{ id: string }> };

export default async function GamePage(props: GamePageProps) {
  // Chaque page vérifie elle-même (§6.2) : le layout n'est pas rendu à chaque navigation.
  const user = await requireUserOrRedirect();
  const id = z.uuid().safeParse((await props.params).id);
  if (!id.success) {
    notFound();
  }
  const db = getDb();
  // Match d'un autre utilisateur ou supprimé : même réponse qu'un inexistant.
  const game = await findGame(db, { gameId: id.data, userId: user.id });
  if (game === null) {
    notFound();
  }
  const [colleagues, note] = await Promise.all([
    listColleagues(db, user.id),
    findNote(db, { gameId: game.id, userId: user.id }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={GAME_NOTES_PATH}
        className="inline-flex min-h-11 items-center self-start underline"
      >
        {t.detail.back}
      </Link>

      {/* En-tête : la carte du match, comme dans les listes. */}
      <section className="grid gap-x-5 gap-y-3 rounded-md border border-border p-4 md:grid-cols-[5.5rem_minmax(0,1fr)_auto]">
        <MatchDate startsAt={game.startsAt} />
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-2xl font-semibold break-words">
            {t.detail.title.replace("{team1}", game.team1Name).replace("{team2}", game.team2Name)}
          </h1>
          <p className="break-words">
            {t.detail.details
              .replace("{division}", divisionLabel(game.division))
              .replace("{address}", addressLabel(game.address))}
          </p>
          {game.compensationId === null && (
            <p className="text-sm text-muted-foreground">{t.detail.noCompensation}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2 md:flex-col md:items-stretch">
          <Link href={`/matchs/${game.id}/modifier`} className={LINK_CLASS}>
            {t.info.edit}
          </Link>
          {game.compensationId !== null && (
            <Link href={`/indemnites/${game.compensationId}/modifier`} className={LINK_CLASS}>
              {t.detail.editCompensation}
            </Link>
          )}
        </div>
      </section>

      <section
        aria-labelledby="game-note"
        className="flex flex-col gap-4 rounded-md border border-border p-4"
      >
        <h2 id="game-note" className="text-lg font-semibold">
          {t.note.legend}
        </h2>
        {/* Clé : une note supprimée (ou recréée) repart de valeurs neuves. */}
        <NoteForm
          key={note?.id ?? "none"}
          action={saveNoteAction}
          gameId={game.id}
          initialValues={noteFormValues(note)}
        />
        {note !== null && note.clips.length > 0 && (
          <div className="flex flex-col gap-2 border-t border-border pt-3">
            <h3 className="text-sm font-medium">{t.note.savedClips}</h3>
            <ul className="flex flex-col gap-1">
              {note.clips.map((url, index) => (
                <li key={url} className="min-w-0">
                  {/* URL normalisée et limitée à http(s) (§6.3), jamais ouverte par le serveur. */}
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 max-w-full items-center underline break-all"
                  >
                    {t.note.clipLink.replace("{number}", String(index + 1))} : {url}
                    <span className="sr-only"> {t.note.opensInNewTab}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
        {note !== null && (
          <div className="border-t border-border pt-3">
            <ConfirmActionButton
              action={deleteNoteAction}
              hidden={{ name: "gameId", value: game.id }}
              labels={{
                submit: t.note.delete,
                warning: t.note.delete,
                confirm: t.delete.confirm,
                cancel: t.delete.cancel,
              }}
              messages={{ deleted: t.note.deleted, not_found: t.errors.gameNotFound }}
              successStatuses={["deleted"]}
            />
          </div>
        )}
      </section>

      <section
        aria-labelledby="game-officials"
        className="flex flex-col gap-4 rounded-md border border-border p-4"
      >
        <h2 id="game-officials" className="text-lg font-semibold">
          {t.officials.legend}
        </h2>
        <OfficialsForm
          framed={false}
          action={updateOfficialsAction}
          colleagues={colleagues}
          initialValues={officialsFormValues(game.officials)}
          hidden={{ name: "gameId", value: game.id }}
          labels={{ submit: t.officials.submit, submitting: t.officials.submitting }}
        />
      </section>

      <section
        aria-labelledby="game-delete"
        className="flex flex-col gap-3 border-t border-border pt-4"
      >
        <div className="flex flex-col gap-1">
          <h2 id="game-delete" className="font-semibold">
            {t.detail.deleteZone}
          </h2>
          <p className="text-sm text-muted-foreground">{t.detail.deleteHint}</p>
        </div>
        <ConfirmActionButton
          action={deleteGameAction}
          hidden={{ name: "gameId", value: game.id }}
          labels={{
            submit: t.delete.submit,
            warning: t.delete.warning,
            confirm: t.delete.confirm,
            cancel: t.delete.cancel,
          }}
          messages={{ not_found: t.errors.gameNotFound }}
        />
      </section>
    </div>
  );
}
