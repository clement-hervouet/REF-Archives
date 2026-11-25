import { describe, expect, it } from "vitest";
import { preparationFormSchema } from "@/lib/schemas/preparations";
import { makeFakeDb } from "./fake-db";
import { VALID_SHARE } from "./share-access";
import {
  findRecipientGame,
  findRecipientPreparation,
  leaveShare,
  listRecipientPreparations,
  listShareCandidates,
  listShareRecipients,
  lockRecipientShare,
  saveRecipientChecks,
  saveRecipientPreparation,
} from "./shared-preparations";

const VIEWER = "5a6b7c8d-9e0f-4a1b-8c2d-3e4f5a6b7c01";
const OWNER = "3f0c1d52-9b0a-4c55-8a3e-2f6f3a1c9e11";
const GAME_ID = "6f7a8b9c-0d1e-4f2a-8b3c-4d5e6f7a8b01";

const TEAM = { rank: "", wins: "", losses: "", players: "", coaches: "", alreadyRefereed: true };
const PREPARATION = preparationFormSchema.parse({
  teamCount: "8",
  team1: TEAM,
  team2: TEAM,
  crew: { placement: "Large", communication: "", management: "", table: "", contact: "" },
  observed: false,
});

const NO_CHECKS = { team1: false, team2: false };

const FILTERS = {
  category: null,
  type: null,
  level: null,
  clubId: null,
  includeWithoutNote: false,
  page: 1,
};

describe("règle d'accès des destinataires", () => {
  it("exige un match actif hors plateau, un arbitre du match et un lien vers le destinataire", () => {
    expect(VALID_SHARE).toContain("g.deleted_at IS NULL");
    expect(VALID_SHARE).toContain("g.team2_id IS NOT NULL");
    expect(VALID_SHARE).toContain("s.person_id IN (g.referee1_id, g.referee2_id, g.referee3_id)");
    expect(VALID_SHARE).toContain("l.linked_user_id = s.recipient_user_id");
    expect(VALID_SHARE).toContain("g.user_id = s.owner_user_id");
  });

  it("s'applique à chaque lecture et écriture du destinataire, filtrée sur son compte", async () => {
    const calls: [string, () => Promise<unknown>][] = [];
    const { db, query } = makeFakeDb();
    const input = { gameId: GAME_ID, viewerId: VIEWER };
    calls.push(["lockRecipientShare", () => lockRecipientShare(db, input)]);
    calls.push(["findRecipientPreparation", () => findRecipientPreparation(db, input)]);
    calls.push(["findRecipientGame", () => findRecipientGame(db, input)]);
    calls.push([
      "saveRecipientPreparation",
      () =>
        saveRecipientPreparation(db, {
          ...input,
          preparation: PREPARATION,
          ownerChecks: NO_CHECKS,
        }),
    ]);
    calls.push([
      "listRecipientPreparations",
      () => listRecipientPreparations(db, { viewerId: VIEWER, filters: FILTERS }),
    ]);
    for (const [name, call] of calls) {
      query.mockClear();
      await call();
      const [sql, values] = query.mock.calls[0] ?? [];
      expect(sql, name).toContain(VALID_SHARE);
      expect(sql, name).toMatch(/s\.recipient_user_id = \$[12]/);
      expect(values, name).toContain(VIEWER);
    }
  });

  it("ne réécrit jamais les cases du propriétaire ni ne change le propriétaire", async () => {
    const { db, query } = makeFakeDb();
    await saveRecipientPreparation(db, {
      gameId: GAME_ID,
      viewerId: VIEWER,
      preparation: PREPARATION,
      ownerChecks: { team1: true, team2: false },
    });
    const [sql, values] = query.mock.calls[0] ?? [];
    // Cases du propriétaire : à la création seulement (jamais dans le DO UPDATE).
    expect(sql).not.toMatch(/already_refereed\s*=/);
    expect(sql).toContain("SELECT s.owner_user_id, s.game_id");
    expect(values?.slice(19)).toEqual([true, false]);
  });

  it("limite les écritures directes du destinataire à son propre partage", async () => {
    const { db, query } = makeFakeDb();
    await saveRecipientChecks(db, {
      gameId: GAME_ID,
      viewerId: VIEWER,
      checks: { team1: true, team2: false },
    });
    await leaveShare(db, { gameId: GAME_ID, viewerId: VIEWER });
    for (const [sql, values] of query.mock.calls) {
      expect(sql).toContain("recipient_user_id = $2");
      expect(values.slice(0, 2)).toEqual([GAME_ID, VIEWER]);
    }
  });
});

describe("vues du propriétaire", () => {
  it("ne liste que les partages valides de ses matchs", async () => {
    const { db, query } = makeFakeDb();
    await listShareRecipients(db, { gameId: GAME_ID, ownerUserId: OWNER });
    await listShareCandidates(db, { gameId: GAME_ID, ownerUserId: OWNER });
    for (const [sql, values] of query.mock.calls) {
      expect(sql).toContain(VALID_SHARE);
      expect(values).toEqual([GAME_ID, OWNER]);
    }
  });
});
