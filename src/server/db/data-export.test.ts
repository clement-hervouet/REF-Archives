import { describe, expect, it } from "vitest";
import { readUserDataExport } from "./data-export";
import { makeFakeDb } from "./fake-db";

const USER_ID = "3f0c1d52-9b0a-4c55-8a3e-2f6f3a1c9e11";

function emptyData(account: Record<string, unknown> | null) {
  return {
    account,
    addresses: [],
    clubs: [],
    teams: [],
    persons: [],
    scales: [],
    levelDefaultScales: [],
    games: [],
    notes: [],
    compensations: [],
    calendarFeed: null,
    sessions: [],
    securityEvents: [],
    reminderDispatches: [],
  };
}

describe("readUserDataExport", () => {
  it("renvoie les sections du compte", async () => {
    const data = {
      ...emptyData({ id: USER_ID, email: "a@example.test" }),
      compensations: [{ id: "c1", distanceMeters: 24000 }],
      calendarFeed: { createdAt: "2026-11-01T10:00:00+01:00" },
    };
    const { db } = makeFakeDb([{ data }]);
    expect(await readUserDataExport(db, USER_ID)).toEqual(data);
  });

  it("compte inexistant : null", async () => {
    const { db } = makeFakeDb([{ data: emptyData(null) }]);
    expect(await readUserDataExport(db, USER_ID)).toBeNull();
  });

  it("refuse un document incomplet", async () => {
    const { account, addresses } = emptyData({ id: USER_ID });
    const { db } = makeFakeDb([{ data: { account, addresses } }]);
    await expect(readUserDataExport(db, USER_ID)).rejects.toThrow();
  });

  it("filtre chaque section par propriétaire, avec l'identifiant en paramètre", async () => {
    const { db, query } = makeFakeDb([{ data: emptyData({ id: USER_ID }) }]);
    await readUserDataExport(db, USER_ID);
    const [sql, values] = query.mock.calls[0] ?? [];
    expect(values).toEqual([USER_ID]);
    expect(sql).not.toContain(USER_ID);
    for (const filter of [
      "u.id = $1",
      "a.user_id = $1",
      "c.user_id = $1",
      "t.user_id = $1",
      "p.user_id = $1",
      "s.user_id = $1",
      "l.user_id = $1",
      "g.user_id = $1",
      "n.user_id = $1",
      "k.user_id = $1",
      "f.user_id = $1",
      "se.user_id = $1",
      "e.user_id = $1 OR e.target_user_id = $1",
      "rd.user_id = $1",
    ]) {
      expect(sql).toContain(filter);
    }
  });

  it("ne sort jamais de hash, d'empreinte de jeton ni d'empreinte d'IP", async () => {
    const { db, query } = makeFakeDb([{ data: emptyData({ id: USER_ID }) }]);
    await readUserDataExport(db, USER_ID);
    const sql = query.mock.calls[0]?.[0] ?? "";
    expect(sql).not.toContain("password_hash");
    expect(sql).not.toContain("token_hash");
    expect(sql).not.toContain("ip_hash");
    expect(sql).not.toContain("password_reset");
    expect(sql).not.toContain("invitation");
  });
});
