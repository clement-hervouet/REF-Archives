import { describe, expect, it } from "vitest";
import { preparationFieldsSchema, preparationFormSchema } from "@/lib/schemas/preparations";
import type { PreparationForm } from "@/lib/schemas/preparations";
import { makeFakeDb } from "../db/fake-db";
import type { Queryable } from "../db/users";
import { saveSharedPreparation } from "./recipient-preparation";

const VIEWER = "5a6b7c8d-9e0f-4a1b-8c2d-3e4f5a6b7c01";
const OWNER = "3f0c1d52-9b0a-4c55-8a3e-2f6f3a1c9e11";
const GAME_ID = "6f7a8b9c-0d1e-4f2a-8b3c-4d5e6f7a8b01";
const PERSON_ID = "8b9c0d1e-2f3a-4b4c-8d5e-6f7a8b9c0d01";

const TEAM = { rank: "", wins: "", losses: "", players: "", coaches: "", alreadyRefereed: false };
const CREW = { placement: "", communication: "", management: "", table: "", contact: "" };

const EMPTY = preparationFieldsSchema.parse({
  teamCount: "",
  team1: TEAM,
  team2: TEAM,
  crew: CREW,
  observed: false,
});

const MINE = preparationFormSchema.parse({
  teamCount: "10",
  team1: { ...TEAM, alreadyRefereed: true },
  team2: TEAM,
  crew: { ...CREW, placement: "Large" },
  observed: false,
});

const SHARE_ROW = {
  starts_at: new Date("2026-11-28T19:00:00Z"),
  owner_user_id: OWNER,
  person_id: PERSON_ID,
  team1_already_refereed: false,
  team2_already_refereed: false,
};

/** Ligne de préparation relue avec `PREPARATION_COLUMNS`. */
function preparationRow(preparation: PreparationForm): Record<string, unknown> {
  const team = (key: "team1" | "team2") => ({
    [`${key}_rank`]: preparation[key].rank,
    [`${key}_wins`]: preparation[key].wins,
    [`${key}_losses`]: preparation[key].losses,
    [`${key}_players`]: preparation[key].players,
    [`${key}_coaches`]: preparation[key].coaches,
    [`${key}_already_refereed`]: preparation[key].alreadyRefereed,
  });
  return {
    id: "9c0d1e2f-3a4b-4c5d-8e6f-7a8b9c0d1e01",
    updated_at: new Date("2026-11-20T10:00:00Z"),
    updated_by: OWNER,
    team_count: preparation.teamCount,
    ...team("team1"),
    ...team("team2"),
    crew_placement: preparation.crew.placement,
    crew_communication: preparation.crew.communication,
    crew_management: preparation.crew.management,
    crew_table: preparation.crew.table,
    crew_contact: preparation.crew.contact,
    observed: preparation.observed,
  };
}

function setup() {
  const { db, query } = makeFakeDb();
  const deps = { transaction: <T>(action: (tx: Queryable) => Promise<T>) => action(db) };
  return { deps, query };
}

describe("saveSharedPreparation", () => {
  it("refuse sans partage valide, sans rien lire d'autre", async () => {
    const { deps, query } = setup();
    expect(
      await saveSharedPreparation(deps, VIEWER, GAME_ID, { preparation: MINE, base: EMPTY }),
    ).toEqual({ status: "not_found" });
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0]?.[1]).toEqual([GAME_ID, VIEWER]);
  });

  it("crée la préparation avec le calcul « déjà arbitrée » du propriétaire et range ses cases sur son partage", async () => {
    const { deps, query } = setup();
    query
      .mockResolvedValueOnce({ rows: [SHARE_ROW] })
      .mockResolvedValueOnce({ rows: [] })
      // Calcul du propriétaire : il a déjà eu le club de l'équipe 2 cette saison.
      .mockResolvedValueOnce({ rows: [{ team1: false, team2: true }] })
      .mockResolvedValueOnce({ rows: [{ id: "9c0d1e2f-3a4b-4c5d-8e6f-7a8b9c0d1e01" }] });
    expect(
      await saveSharedPreparation(deps, VIEWER, GAME_ID, { preparation: MINE, base: EMPTY }),
    ).toEqual({ status: "saved" });
    // Le calcul porte sur le compte du propriétaire, depuis le début de la saison du match.
    expect(query.mock.calls[2]?.[1]).toEqual([GAME_ID, OWNER, new Date("2026-06-30T22:00:00Z")]);
    const [upsertSql, upsertValues] = query.mock.calls[3] ?? [];
    // Les cases du propriétaire ne sont jamais réécrites par le destinataire.
    expect(upsertSql).not.toMatch(/already_refereed\s*=/);
    expect(upsertValues?.slice(0, 3)).toEqual([GAME_ID, VIEWER, 10]);
    expect(upsertValues?.slice(19)).toEqual([false, true]);
    expect(query.mock.calls[4]?.[1]).toEqual([GAME_ID, VIEWER, true, false]);
  });

  it("garde les cases du propriétaire et signale un conflit avec les cases du destinataire", async () => {
    const { deps, query } = setup();
    const current = {
      ...MINE,
      team1: { ...MINE.team1, alreadyRefereed: false },
      team2: { ...MINE.team2, alreadyRefereed: true },
      crew: { ...MINE.crew, placement: "Serré" },
    };
    query
      .mockResolvedValueOnce({ rows: [{ ...SHARE_ROW, team1_already_refereed: true }] })
      .mockResolvedValueOnce({ rows: [preparationRow(current)] });
    const base = { ...MINE, crew: { ...MINE.crew, placement: "Moyen" } };
    const result = await saveSharedPreparation(deps, VIEWER, GAME_ID, { preparation: MINE, base });
    expect(result).toMatchObject({
      status: "conflict",
      conflicts: ["placement"],
      // Cases du destinataire (équipe 1 cochée), pas celles du propriétaire.
      saved: { placement: "Serré", team1AlreadyRefereed: "1", team2AlreadyRefereed: "" },
    });
    expect(query).toHaveBeenCalledTimes(2);
  });
});
