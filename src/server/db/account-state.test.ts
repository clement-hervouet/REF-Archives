import { describe, expect, it } from "vitest";
import { ACTIVE_ACCOUNT_CONDITION, accountSuspension } from "./account-state";

const NOW = new Date("2026-11-08T12:00:00Z");
const ACTIVE = { blockedAt: null, blockedUntil: null, deletionDueAt: null };

describe("accountSuspension", () => {
  it("compte sans blocage ni suppression : actif", () => {
    expect(accountSuspension(ACTIVE, NOW)).toBeNull();
  });

  it("blocage en cours, avec ou sans fin", () => {
    const until = new Date("2026-11-15T00:00:00Z");
    expect(
      accountSuspension(
        { ...ACTIVE, blockedAt: new Date("2026-11-07T00:00:00Z"), blockedUntil: until },
        NOW,
      ),
    ).toEqual({ kind: "blocked", until });
    expect(
      accountSuspension({ ...ACTIVE, blockedAt: new Date("2026-11-07T00:00:00Z") }, NOW),
    ).toEqual({
      kind: "blocked",
      until: null,
    });
  });

  it("blocage terminé (fin passée ou atteinte) : actif", () => {
    const blockedAt = new Date("2026-11-01T00:00:00Z");
    expect(accountSuspension({ ...ACTIVE, blockedAt, blockedUntil: NOW }, NOW)).toBeNull();
    expect(
      accountSuspension(
        { ...ACTIVE, blockedAt, blockedUntil: new Date("2026-11-02T00:00:00Z") },
        NOW,
      ),
    ).toBeNull();
  });

  it("suppression programmée : prioritaire sur le blocage", () => {
    const dueAt = new Date("2026-12-08T12:00:00Z");
    expect(
      accountSuspension(
        { blockedAt: new Date("2026-11-07T00:00:00Z"), blockedUntil: null, deletionDueAt: dueAt },
        NOW,
      ),
    ).toEqual({ kind: "deletion", dueAt });
  });

  it("la condition SQL couvre les deux cas", () => {
    expect(ACTIVE_ACCOUNT_CONDITION).toContain("u.blocked_until <= now()");
    expect(ACTIVE_ACCOUNT_CONDITION).toContain("u.deletion_due_at IS NULL");
  });
});
