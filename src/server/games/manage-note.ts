/**
 * Note d'un match complet (bloc 9) : écrite avec ses liens en une transaction, sous
 * verrou du match (une suppression simultanée du match ne peut pas passer entre-temps).
 * La Server Action valide le formulaire (`noteFormSchema`) AVANT d'appeler ce service.
 */
import type { NoteForm } from "@/lib/schemas/notes";
import { lockGame } from "../db/game-writes";
import { saveNote } from "../db/notes";
import { rejectGame, runRejectable } from "./rejection";
import type { GameDeps, GameRejection } from "./rejection";

export type SaveGameNoteResult = { status: "saved" } | GameRejection;

/** Crée ou remplace la note d'un match de `userId`. */
export async function saveGameNote(
  deps: GameDeps,
  userId: string,
  gameId: string,
  note: NoteForm,
): Promise<SaveGameNoteResult> {
  return runRejectable(deps, async (db): Promise<SaveGameNoteResult> => {
    if (!(await lockGame(db, { gameId, userId }))) {
      rejectGame({ status: "not_found", field: "game" });
    }
    await saveNote(db, { userId, gameId, note });
    return { status: "saved" };
  });
}
