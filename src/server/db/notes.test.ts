import { describe, expect, it } from "vitest";
import { makeFakeDb } from "./fake-db";
import { findNote, saveNote, softDeleteNote } from "./notes";

const USER_ID = "3f0c1d52-9b0a-4c55-8a3e-2f6f3a1c9e11";
const GAME_ID = "6f7a8b9c-0d1e-4f2a-8b3c-4d5e6f7a8b01";
const NOTE_ID = "7a8b9c0d-1e2f-4a3b-8c4d-5e6f7a8b9c01";

const CLIPS = ["https://example.com/a", "https://example.com/b"];

describe("saveNote", () => {
  it("écrit la note puis remplace ses liens dans l'ordre", async () => {
    const { db, query } = makeFakeDb([{ id: NOTE_ID }]);
    expect(
      await saveNote(db, {
        userId: USER_ID,
        gameId: GAME_ID,
        note: { confidence: 4, stress: null, body: "RAS", clips: CLIPS },
      }),
    ).toBe(NOTE_ID);
    expect(query).toHaveBeenCalledTimes(3);
    expect(query.mock.calls[0]?.[0]).toContain("ON CONFLICT (game_id) WHERE deleted_at IS NULL");
    expect(query.mock.calls[0]?.[1]).toEqual([USER_ID, GAME_ID, 4, null, "RAS"]);
    expect(query.mock.calls[1]?.[1]).toEqual([NOTE_ID, USER_ID]);
    expect(query.mock.calls[2]?.[1]).toEqual([USER_ID, NOTE_ID, CLIPS]);
  });

  it("supprime les liens sans en insérer quand il n'y en a plus", async () => {
    const { db, query } = makeFakeDb([{ id: NOTE_ID }]);
    await saveNote(db, {
      userId: USER_ID,
      gameId: GAME_ID,
      note: { confidence: null, stress: 2, body: null, clips: [] },
    });
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[1]?.[0]).toContain("DELETE FROM note_clip");
  });
});

describe("softDeleteNote", () => {
  it("supprime la note active du match de l'utilisateur", async () => {
    const { db, query } = makeFakeDb([{ id: NOTE_ID }]);
    expect(await softDeleteNote(db, { userId: USER_ID, gameId: GAME_ID })).toBe(true);
    expect(query.mock.calls[0]?.[1]).toEqual([GAME_ID, USER_ID]);
  });

  it("faux s'il n'y en a pas", async () => {
    const { db } = makeFakeDb();
    expect(await softDeleteNote(db, { userId: USER_ID, gameId: GAME_ID })).toBe(false);
  });
});

describe("findNote", () => {
  it("renvoie la note et ses liens", async () => {
    const updatedAt = new Date("2026-11-15T10:00:00Z");
    const { db, query } = makeFakeDb([
      { id: NOTE_ID, confidence: 3, stress: 4, body: null, updated_at: updatedAt, clips: CLIPS },
    ]);
    expect(await findNote(db, { userId: USER_ID, gameId: GAME_ID })).toEqual({
      id: NOTE_ID,
      confidence: 3,
      stress: 4,
      body: null,
      clips: CLIPS,
      updatedAt,
    });
    expect(query.mock.calls[0]?.[1]).toEqual([GAME_ID, USER_ID]);
  });

  it("null s'il n'y a pas de note", async () => {
    const { db } = makeFakeDb();
    expect(await findNote(db, { userId: USER_ID, gameId: GAME_ID })).toBeNull();
  });
});
