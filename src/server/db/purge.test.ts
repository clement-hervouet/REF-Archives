import { describe, expect, it } from "vitest";
import { makeFakeDb } from "./fake-db";
import {
  purgeArchivedScales,
  purgeDeletedCompensations,
  purgeDeletedGames,
  purgeDeletedNotes,
  purgeEndedInvitations,
  purgeEndedSessions,
  purgeExpiredPasswordResets,
  purgeForgottenRateLimits,
  purgeOldReminderDispatches,
  purgeOldSecurityEvents,
} from "./purge";

const WITH_DAYS = [
  { name: "indemnités", table: "compensation", run: purgeDeletedCompensations },
  { name: "notes", table: "note", run: purgeDeletedNotes },
  { name: "matchs", table: "game", run: purgeDeletedGames },
  { name: "barèmes", table: "scale", run: purgeArchivedScales },
  { name: "journal de sécurité", table: "security_event", run: purgeOldSecurityEvents },
  { name: "réservations de rappels", table: "reminder_dispatch", run: purgeOldReminderDispatches },
  { name: "sessions", table: "session", run: purgeEndedSessions },
  { name: "invitations", table: "invitation", run: purgeEndedInvitations },
];

describe("purge : requêtes avec délai en jours", () => {
  for (const { name, table, run } of WITH_DAYS) {
    it(`${name} : DELETE paramétré sur ${table}, renvoie le nombre de lignes effacées`, async () => {
      const { db, query } = makeFakeDb([{ count: 4 }]);
      expect(await run(db, 30)).toBe(4);
      const [sql, values] = query.mock.calls[0] ?? [];
      expect(sql).toContain(`DELETE FROM ${table}`);
      expect(sql).toContain("$1::integer * interval '1 day'");
      expect(sql).not.toContain("30");
      expect(values).toEqual([30]);
    });
  }

  it("rien à effacer : 0", async () => {
    const { db } = makeFakeDb([{ count: 0 }]);
    expect(await purgeDeletedCompensations(db, 30)).toBe(0);
  });

  it("refuse une réponse de forme inattendue", async () => {
    const { db } = makeFakeDb([{ count: "4" }]);
    await expect(purgeDeletedNotes(db, 30)).rejects.toThrow();
  });
});

describe("purgeArchivedScales", () => {
  it("épargne le barème commun et les barèmes encore référencés par une indemnité", async () => {
    const { db, query } = makeFakeDb([{ count: 0 }]);
    await purgeArchivedScales(db, 30);
    const sql = query.mock.calls[0]?.[0];
    expect(sql).toContain("s.user_id IS NOT NULL");
    expect(sql).toContain("NOT EXISTS");
    expect(sql).toContain("c.scale_rate_id");
  });
});

describe("purgeEndedInvitations", () => {
  it("date la fin par l'acceptation, la révocation, sinon l'expiration", async () => {
    const { db, query } = makeFakeDb([{ count: 0 }]);
    await purgeEndedInvitations(db, 30);
    expect(query.mock.calls[0]?.[0]).toContain("coalesce(accepted_at, revoked_at, expires_at)");
  });
});

describe("purgeExpiredPasswordResets", () => {
  it("efface les liens expirés, sans paramètre", async () => {
    const { db, query } = makeFakeDb([{ count: 2 }]);
    expect(await purgeExpiredPasswordResets(db)).toBe(2);
    const [sql, values] = query.mock.calls[0] ?? [];
    expect(sql).toContain("DELETE FROM password_reset");
    expect(sql).toContain("expires_at <= now()");
    expect(values).toEqual([]);
  });
});

describe("purgeForgottenRateLimits", () => {
  it("efface les compteurs inactifs depuis le délai donné en secondes", async () => {
    const { db, query } = makeFakeDb([{ count: 1 }]);
    expect(await purgeForgottenRateLimits(db, 86_400)).toBe(1);
    const [sql, values] = query.mock.calls[0] ?? [];
    expect(sql).toContain("DELETE FROM rate_limit");
    expect(sql).toContain("$1::integer * interval '1 second'");
    expect(values).toEqual([86_400]);
  });
});
