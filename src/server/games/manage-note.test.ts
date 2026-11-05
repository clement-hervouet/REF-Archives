import { describe, expect, it } from "vitest";
import { noteFormSchema } from "@/lib/schemas/notes";
import { makeFakeDb } from "../db/fake-db";
import type { Queryable } from "../db/users";
import { saveGameNote } from "./manage-note";
import type { GameDeps } from "./rejection";

const USER_ID = "3f0c1d52-9b0a-4c55-8a3e-2f6f3a1c9e11";
const GAME_ID = "6f7a8b9c-0d1e-4f2a-8b3c-4d5e6f7a8b01";
const NOTE_ID = "7a8b9c0d-1e2f-4a3b-8c4d-5e6f7a8b9c01";

const NOTE = noteFormSchema.parse({
  confidence: "4",
  stress: "2",
  body: "Bon placement en fin de match.",
  clips: ["https://example.com/clip"],
});

function setup() {
  const { db, query } = makeFakeDb();
  const deps = {
    transaction: <T>(action: (tx: Queryable) => Promise<T>) => action(db),
  } satisfies GameDeps;
  return { deps, query };
}

describe("saveGameNote", () => {
  it("verrouille le match puis écrit la note et ses liens", async () => {
    const { deps, query } = setup();
    query
      .mockResolvedValueOnce({ rows: [{ id: GAME_ID }] })
      .mockResolvedValueOnce({ rows: [{ id: NOTE_ID }] });
    expect(await saveGameNote(deps, USER_ID, GAME_ID, NOTE)).toEqual({ status: "saved" });
    expect(query).toHaveBeenCalledTimes(4);
    expect(query.mock.calls[0]?.[1]).toEqual([GAME_ID, USER_ID]);
    expect(query.mock.calls[1]?.[1]).toEqual([
      USER_ID,
      GAME_ID,
      4,
      2,
      "Bon placement en fin de match.",
    ]);
    expect(query.mock.calls[3]?.[1]).toEqual([USER_ID, NOTE_ID, ["https://example.com/clip"]]);
  });

  it("refuse un match introuvable, supprimé ou d'un autre utilisateur", async () => {
    const { deps, query } = setup();
    expect(await saveGameNote(deps, USER_ID, GAME_ID, NOTE)).toEqual({
      status: "not_found",
      field: "game",
    });
    expect(query).toHaveBeenCalledTimes(1);
  });
});
