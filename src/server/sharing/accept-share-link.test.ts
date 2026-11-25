import { describe, expect, it, vi } from "vitest";
import { makeFakeDb } from "../db/fake-db";
import type { Queryable } from "../db/users";
import type { AttemptDecision } from "../auth/rate-limit";
import { hashToken } from "../auth/tokens";
import { acceptShareLink } from "./accept-share-link";

const OWNER = "3f0c1d52-9b0a-4c55-8a3e-2f6f3a1c9e11";
const VIEWER = "5a6b7c8d-9e0f-4a1b-8c2d-3e4f5a6b7c01";
const GAME_ID = "6f7a8b9c-0d1e-4f2a-8b3c-4d5e6f7a8b01";
const PERSON_ID = "8b9c0d1e-2f3a-4b4c-8d5e-6f7a8b9c0d01";
const LINK_ID = "9c0d1e2f-3a4b-4c5d-8e6f-7a8b9c0d1e01";
const TOKEN = "a".repeat(43);

const LINK_ROW = { id: LINK_ID, owner_user_id: OWNER, game_id: GAME_ID, person_id: PERSON_ID };

function setup(decision: AttemptDecision = { admitted: true }) {
  const { db, query } = makeFakeDb();
  const admitAttempt = vi
    .fn<(keys: string[], now: Date) => Promise<AttemptDecision>>()
    .mockResolvedValue(decision);
  const deps = {
    transaction: <T>(action: (tx: Queryable) => Promise<T>) => action(db),
    admitAttempt,
    now: () => new Date("2026-11-25T10:00:00Z"),
  };
  return { deps, query, admitAttempt };
}

const NONE = { kind: "none" } as const;

describe("acceptShareLink", () => {
  it("refuse un jeton mal formé sans compter de tentative", async () => {
    const { deps, admitAttempt, query } = setup();
    expect(await acceptShareLink(deps, { token: "abc", viewerId: VIEWER, reverse: NONE })).toEqual({
      status: "invalid",
    });
    expect(admitAttempt).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });

  it("limite les tentatives par compte et par jeton, avec des clés hachées", async () => {
    const { deps, admitAttempt, query } = setup({ admitted: false, retryAfterSeconds: 120 });
    expect(await acceptShareLink(deps, { token: TOKEN, viewerId: VIEWER, reverse: NONE })).toEqual({
      status: "rate_limited",
      retryAfterSeconds: 120,
    });
    const keys = admitAttempt.mock.calls[0]?.[0] ?? [];
    expect(keys).toHaveLength(2);
    expect(keys.join(" ")).not.toContain(TOKEN);
    expect(keys.join(" ")).not.toContain(VIEWER);
    expect(query).not.toHaveBeenCalled();
  });

  it("refuse un lien inconnu, expiré, utilisé ou révoqué (cherché par empreinte)", async () => {
    const { deps, query } = setup();
    expect(await acceptShareLink(deps, { token: TOKEN, viewerId: VIEWER, reverse: NONE })).toEqual({
      status: "invalid",
    });
    expect(query.mock.calls[0]?.[1]).toEqual([hashToken(TOKEN)]);
  });

  it("refuse au propriétaire d'accepter son propre lien", async () => {
    const { deps, query } = setup();
    query.mockResolvedValueOnce({ rows: [LINK_ROW] });
    expect(await acceptShareLink(deps, { token: TOKEN, viewerId: OWNER, reverse: NONE })).toEqual({
      status: "own_link",
    });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("refuse un lien dont le match n'est plus partageable", async () => {
    const { deps, query } = setup();
    query.mockResolvedValueOnce({ rows: [LINK_ROW] }).mockResolvedValueOnce({ rows: [] });
    expect(await acceptShareLink(deps, { token: TOKEN, viewerId: VIEWER, reverse: NONE })).toEqual({
      status: "invalid",
    });
    expect(query).toHaveBeenCalledTimes(2);
  });

  it("refuse une fiche déjà liée à un autre compte", async () => {
    const { deps, query } = setup();
    query
      .mockResolvedValueOnce({ rows: [LINK_ROW] })
      .mockResolvedValueOnce({ rows: [{ linked_user_id: null }] })
      .mockResolvedValueOnce({ rows: [LINK_ROW] })
      .mockResolvedValueOnce({ rows: [{ linked_user_id: OWNER, person_id: null }] });
    expect(await acceptShareLink(deps, { token: TOKEN, viewerId: VIEWER, reverse: NONE })).toEqual({
      status: "taken",
    });
    expect(query).toHaveBeenCalledTimes(4);
  });

  it("lie les comptes, partage et consomme le lien", async () => {
    const { deps, query } = setup();
    query
      .mockResolvedValueOnce({ rows: [LINK_ROW] })
      .mockResolvedValueOnce({ rows: [{ linked_user_id: null }] })
      .mockResolvedValueOnce({ rows: [LINK_ROW] })
      .mockResolvedValueOnce({ rows: [{ linked_user_id: null, person_id: null }] })
      .mockResolvedValueOnce({ rows: [{ person_id: PERSON_ID }] });
    expect(await acceptShareLink(deps, { token: TOKEN, viewerId: VIEWER, reverse: NONE })).toEqual({
      status: "accepted",
      gameId: GAME_ID,
      ownerUserId: OWNER,
      newlyLinked: true,
      linkedBack: false,
    });
    const statements = query.mock.calls.map(([sql]) => sql);
    // Verrous dans l'ordre : le match, puis le lien.
    expect(statements[0]).not.toContain("FOR UPDATE");
    expect(statements[1]).toContain("FOR UPDATE OF g");
    expect(statements[2]).toContain("FROM preparation_share_link");
    expect(statements[2]).toContain("FOR UPDATE");
    expect(statements[4]).toContain("INSERT INTO colleague_link");
    expect(query.mock.calls[4]?.[1]).toEqual([OWNER, PERSON_ID, VIEWER]);
    expect(statements[5]).toContain("INSERT INTO game_share");
    expect(query.mock.calls[5]?.[1]).toEqual([OWNER, GAME_ID, PERSON_ID, VIEWER]);
    expect(query.mock.calls[6]?.[1]).toEqual([LINK_ID, VIEWER]);
    expect(query).toHaveBeenCalledTimes(7);
  });

  it("refuse un lien consommé ou révoqué pendant qu'il attendait le verrou du match", async () => {
    const { deps, query } = setup();
    query
      .mockResolvedValueOnce({ rows: [LINK_ROW] })
      .mockResolvedValueOnce({ rows: [{ linked_user_id: null }] })
      .mockResolvedValueOnce({ rows: [] });
    expect(await acceptShareLink(deps, { token: TOKEN, viewerId: VIEWER, reverse: NONE })).toEqual({
      status: "invalid",
    });
    expect(query).toHaveBeenCalledTimes(3);
  });

  it("partage sans relier quand la fiche est déjà liée à ce compte", async () => {
    const { deps, query } = setup();
    query
      .mockResolvedValueOnce({ rows: [LINK_ROW] })
      .mockResolvedValueOnce({ rows: [{ linked_user_id: VIEWER }] })
      .mockResolvedValueOnce({ rows: [LINK_ROW] })
      .mockResolvedValueOnce({ rows: [{ linked_user_id: VIEWER, person_id: PERSON_ID }] });
    expect(
      await acceptShareLink(deps, { token: TOKEN, viewerId: VIEWER, reverse: NONE }),
    ).toMatchObject({ status: "accepted", newlyLinked: false });
    expect(query.mock.calls.map(([sql]) => sql).join("\n")).not.toContain(
      "INSERT INTO colleague_link",
    );
  });

  it("ajoute le propriétaire aux collègues du destinataire, à son nom", async () => {
    const { deps, query } = setup();
    const NEW_PERSON = "0d1e2f3a-4b5c-4d6e-8f7a-8b9c0d1e2f01";
    query
      .mockResolvedValueOnce({ rows: [LINK_ROW] })
      .mockResolvedValueOnce({ rows: [{ linked_user_id: VIEWER }] })
      .mockResolvedValueOnce({ rows: [LINK_ROW] })
      .mockResolvedValueOnce({ rows: [{ linked_user_id: VIEWER, person_id: PERSON_ID }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ firstname: "Clément", lastname: "Hervouet" }] })
      .mockResolvedValueOnce({ rows: [{ id: NEW_PERSON }] })
      .mockResolvedValueOnce({ rows: [{ linked_user_id: null, person_id: null }] })
      .mockResolvedValueOnce({ rows: [{ person_id: NEW_PERSON }] });
    expect(
      await acceptShareLink(deps, { token: TOKEN, viewerId: VIEWER, reverse: { kind: "create" } }),
    ).toMatchObject({ status: "accepted", newlyLinked: false, linkedBack: true });
    // Pas encore lié au propriétaire : fiche créée chez le destinataire, puis liée.
    expect(query.mock.calls[6]?.[1]).toEqual([VIEWER, OWNER]);
    expect(query.mock.calls[8]?.[1]?.slice(0, 4)).toEqual([VIEWER, "Clément", "Hervouet", true]);
    expect(query.mock.calls[10]?.[1]).toEqual([VIEWER, NEW_PERSON, OWNER]);
    expect(query).toHaveBeenCalledTimes(11);
  });

  it("ne crée pas de fiche en double si le destinataire est déjà lié au propriétaire", async () => {
    const { deps, query } = setup();
    query
      .mockResolvedValueOnce({ rows: [LINK_ROW] })
      .mockResolvedValueOnce({ rows: [{ linked_user_id: VIEWER }] })
      .mockResolvedValueOnce({ rows: [LINK_ROW] })
      .mockResolvedValueOnce({ rows: [{ linked_user_id: VIEWER, person_id: PERSON_ID }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ person_id: "0d1e2f3a-4b5c-4d6e-8f7a-8b9c0d1e2f01" }] });
    expect(
      await acceptShareLink(deps, { token: TOKEN, viewerId: VIEWER, reverse: { kind: "create" } }),
    ).toMatchObject({ status: "accepted", linkedBack: false });
    expect(query.mock.calls.map(([sql]) => sql).join("\n")).not.toContain("INSERT INTO person");
    expect(query).toHaveBeenCalledTimes(7);
  });

  it("retire la fiche créée si une acceptation simultanée a déjà lié le propriétaire", async () => {
    const { deps, query } = setup();
    const NEW_PERSON = "0d1e2f3a-4b5c-4d6e-8f7a-8b9c0d1e2f01";
    query
      .mockResolvedValueOnce({ rows: [LINK_ROW] })
      .mockResolvedValueOnce({ rows: [{ linked_user_id: VIEWER }] })
      .mockResolvedValueOnce({ rows: [LINK_ROW] })
      .mockResolvedValueOnce({ rows: [{ linked_user_id: VIEWER, person_id: PERSON_ID }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ firstname: "Clément", lastname: "Hervouet" }] })
      .mockResolvedValueOnce({ rows: [{ id: NEW_PERSON }] })
      // Entre-temps, le propriétaire est lié à une autre fiche du destinataire.
      .mockResolvedValueOnce({ rows: [{ linked_user_id: null, person_id: PERSON_ID }] })
      .mockResolvedValueOnce({ rows: [{ id: NEW_PERSON }] });
    expect(
      await acceptShareLink(deps, { token: TOKEN, viewerId: VIEWER, reverse: { kind: "create" } }),
    ).toMatchObject({ linkedBack: false });
    const last = query.mock.calls.at(-1);
    expect(last?.[0]).toContain("DELETE FROM person");
    expect(last?.[1]).toEqual([NEW_PERSON, VIEWER]);
  });
});
