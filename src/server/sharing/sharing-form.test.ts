import { describe, expect, it, vi } from "vitest";
import { makeFakeDb } from "../db/fake-db";
import type { Queryable } from "../db/users";
import { handleAcceptShare, handleShare, handleUnlinkFromOwner } from "./sharing-form";

const OWNER = "3f0c1d52-9b0a-4c55-8a3e-2f6f3a1c9e11";
const GAME_ID = "6f7a8b9c-0d1e-4f2a-8b3c-4d5e6f7a8b01";
const PERSON_ID = "8b9c0d1e-2f3a-4b4c-8d5e-6f7a8b9c0d01";

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(entries)) {
    data.set(name, value);
  }
  return data;
}

function setup() {
  const { db, query } = makeFakeDb();
  const transaction = <T>(action: (tx: Queryable) => Promise<T>) => action(db);
  return {
    query,
    deps: {
      transaction,
      generateToken: () => ({ token: "t".repeat(43), hash: Buffer.alloc(32) }),
      now: () => new Date("2026-11-25T10:00:00Z"),
      appUrl: "https://ref.test",
      admitAttempt: vi.fn(() => Promise.resolve({ admitted: true as const })),
    },
  };
}

describe("handleShare", () => {
  it("refuse des identifiants ou une intention invalides sans requête", async () => {
    const { deps, query } = setup();
    for (const entries of [
      { gameId: "x", personId: PERSON_ID, intent: "share" },
      { gameId: GAME_ID, personId: PERSON_ID, intent: "delete" },
      { gameId: GAME_ID, intent: "share" },
    ]) {
      expect(await handleShare(deps, OWNER, form(entries))).toEqual({ status: "not_found" });
    }
    expect(query).not.toHaveBeenCalled();
  });

  it("renvoie le lien créé avec sa date de fin en ISO", async () => {
    const { deps, query } = setup();
    query
      .mockResolvedValueOnce({ rows: [{ linked_user_id: null }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: GAME_ID }] });
    expect(
      await handleShare(
        deps,
        OWNER,
        form({ gameId: GAME_ID, personId: PERSON_ID, intent: "link" }),
      ),
    ).toEqual({
      status: "link_created",
      url: `https://ref.test/partage/${"t".repeat(43)}`,
      expiresAt: "2026-12-02T10:00:00.000Z",
    });
  });
});

describe("handleUnlinkFromOwner", () => {
  it("refuse un identifiant de propriétaire invalide", async () => {
    const { deps, query } = setup();
    expect(await handleUnlinkFromOwner(deps, OWNER, form({ ownerId: "abc" }))).toEqual({
      status: "not_found",
    });
    expect(query).not.toHaveBeenCalled();
  });
});

describe("handleAcceptShare", () => {
  it("transmet le jeton et l'association demandée", async () => {
    const { deps, query } = setup();
    // Lien introuvable : seule la recherche par empreinte a lieu.
    expect(
      await handleAcceptShare(deps, OWNER, form({ token: "a".repeat(43), reverse: "create" })),
    ).toEqual({ status: "invalid" });
    expect(query).toHaveBeenCalledTimes(1);
    expect(deps.admitAttempt).toHaveBeenCalledTimes(1);
  });
});
