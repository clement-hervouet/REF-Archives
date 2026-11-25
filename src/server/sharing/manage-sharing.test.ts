import { describe, expect, it } from "vitest";
import { makeFakeDb } from "../db/fake-db";
import type { Queryable } from "../db/users";
import {
  createLink,
  leaveSharedPreparation,
  revokeLink,
  shareWithColleague,
  stopSharing,
  unlinkColleague,
  unlinkFromOwner,
} from "./manage-sharing";

const OWNER = "3f0c1d52-9b0a-4c55-8a3e-2f6f3a1c9e11";
const COLLEAGUE = "5a6b7c8d-9e0f-4a1b-8c2d-3e4f5a6b7c01";
const GAME_ID = "6f7a8b9c-0d1e-4f2a-8b3c-4d5e6f7a8b01";
const PERSON_ID = "8b9c0d1e-2f3a-4b4c-8d5e-6f7a8b9c0d01";
const INPUT = { gameId: GAME_ID, personId: PERSON_ID };

function setup() {
  const { db, query } = makeFakeDb();
  const transaction = <T>(action: (tx: Queryable) => Promise<T>) => action(db);
  return { query, deps: { transaction } };
}

describe("shareWithColleague", () => {
  it("partage avec le compte lié à la fiche, vérifiée sous verrou chez le propriétaire", async () => {
    const { deps, query } = setup();
    query.mockResolvedValueOnce({ rows: [{ linked_user_id: COLLEAGUE }] });
    expect(await shareWithColleague(deps, OWNER, INPUT)).toEqual({ status: "shared" });
    expect(query.mock.calls[0]?.[1]).toEqual([GAME_ID, OWNER, PERSON_ID]);
    expect(query.mock.calls[0]?.[0]).toContain("FOR UPDATE");
    expect(query.mock.calls[1]?.[1]).toEqual([OWNER, GAME_ID, PERSON_ID, COLLEAGUE]);
  });

  it("refuse une fiche non liée ou un match qui ne s'y prête pas, sans rien écrire", async () => {
    const notLinked = setup();
    notLinked.query.mockResolvedValueOnce({ rows: [{ linked_user_id: null }] });
    expect(await shareWithColleague(notLinked.deps, OWNER, INPUT)).toEqual({
      status: "not_linked",
    });
    expect(notLinked.query).toHaveBeenCalledTimes(1);

    const missing = setup();
    expect(await shareWithColleague(missing.deps, OWNER, INPUT)).toEqual({ status: "not_found" });
    expect(missing.query).toHaveBeenCalledTimes(1);
  });
});

describe("createLink", () => {
  const token = { token: "t".repeat(43), hash: Buffer.alloc(32, 1) };
  const now = new Date("2026-11-25T10:00:00Z");

  function linkDeps() {
    const { deps, query } = setup();
    return {
      query,
      deps: { ...deps, generateToken: () => token, now: () => now, appUrl: "https://ref.test" },
    };
  }

  it("renvoie le lien complet, valable 7 jours, et ne stocke que l'empreinte", async () => {
    const { deps, query } = linkDeps();
    query
      .mockResolvedValueOnce({ rows: [{ linked_user_id: null }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: "9c0d1e2f-3a4b-4c5d-8e6f-7a8b9c0d1e01" }] });
    expect(await createLink(deps, OWNER, INPUT)).toEqual({
      status: "link_created",
      url: `https://ref.test/partage/${token.token}`,
      expiresAt: new Date("2026-12-02T10:00:00Z"),
    });
    const insert = query.mock.calls[2]?.[1];
    expect(insert?.[3]).toBe(token.hash);
    expect(insert).not.toContain(token.token);
  });

  it("ne crée pas de lien pour une fiche déjà liée", async () => {
    const { deps, query } = linkDeps();
    query.mockResolvedValueOnce({ rows: [{ linked_user_id: COLLEAGUE }] });
    expect(await createLink(deps, OWNER, INPUT)).toEqual({ status: "already_linked" });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("signale la limite de liens en attente", async () => {
    const { deps, query } = linkDeps();
    query
      .mockResolvedValueOnce({ rows: [{ linked_user_id: null }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: null }] });
    expect(await createLink(deps, OWNER, INPUT)).toEqual({ status: "limit_reached" });
  });
});

describe("révocations et déliaisons", () => {
  it("révoque un lien, arrête un partage, quitte un partage", async () => {
    const revoke = setup();
    revoke.query.mockResolvedValueOnce({ rows: [{ id: GAME_ID }] });
    expect(await revokeLink(revoke.deps, OWNER, INPUT)).toEqual({ status: "revoked" });

    const stop = setup();
    expect(await stopSharing(stop.deps, OWNER, INPUT)).toEqual({ status: "not_found" });
    expect(stop.query.mock.calls[0]?.[1]).toEqual([GAME_ID, OWNER, PERSON_ID]);

    const leave = setup();
    leave.query.mockResolvedValueOnce({ rows: [{ game_id: GAME_ID }] });
    expect(await leaveSharedPreparation(leave.deps, COLLEAGUE, GAME_ID)).toEqual({
      status: "left",
    });
    expect(leave.query.mock.calls[0]?.[1]).toEqual([GAME_ID, COLLEAGUE]);
  });

  it("délie depuis la fiche du propriétaire ou depuis le compte du collègue", async () => {
    const owner = setup();
    owner.query.mockResolvedValueOnce({
      rows: [{ person_id: PERSON_ID, linked_user_id: COLLEAGUE }],
    });
    expect(await unlinkColleague(owner.deps, OWNER, PERSON_ID)).toBe(COLLEAGUE);
    expect(owner.query.mock.calls[0]?.[1]).toEqual([OWNER, PERSON_ID, null]);

    const colleague = setup();
    expect(await unlinkFromOwner(colleague.deps, COLLEAGUE, OWNER)).toBe(false);
    // Le collègue ne délie que les liens vers son propre compte.
    expect(colleague.query.mock.calls[0]?.[1]).toEqual([OWNER, null, COLLEAGUE]);
  });
});
