import { describe, expect, it } from "vitest";
import type { AccountSummary } from "@/server/db/accounts";
import {
  accountContentsLabel,
  accountName,
  accountSearchText,
  accountStatus,
  accountTimeline,
  suspendedCountLabel,
} from "./account-labels";

const NOW = new Date("2026-11-08T19:00:00Z");
const ACCOUNT: AccountSummary = {
  id: "00000000-0000-4000-8000-000000000002",
  email: "elodie@example.test",
  role: "user",
  firstname: "Élodie",
  lastname: "Le Goff",
  createdAt: new Date("2026-01-05T09:00:00Z"),
  lastSeenAt: null,
  state: { blockedAt: null, blockedUntil: null, deletionDueAt: null },
};

describe("accountName", () => {
  it("prénom et nom, sinon l'email", () => {
    expect(accountName(ACCOUNT)).toBe("Élodie Le Goff");
    expect(accountName({ ...ACCOUNT, firstname: null, lastname: null })).toBe(
      "elodie@example.test",
    );
  });
});

describe("accountSearchText", () => {
  it("nom, prénom et email, sans accents", () => {
    expect(accountSearchText(ACCOUNT)).toBe("elodie le goff elodie@example.test");
  });
});

describe("accountStatus", () => {
  it("actif", () => {
    expect(accountStatus(ACCOUNT, NOW)).toEqual({
      tone: "success",
      label: "Actif",
      suspended: false,
    });
  });

  it("bloqué avec date : jaune ; sans fin : rouge", () => {
    const blockedAt = new Date("2026-11-07T00:00:00Z");
    expect(
      accountStatus(
        {
          ...ACCOUNT,
          state: { ...ACCOUNT.state, blockedAt, blockedUntil: new Date("2026-11-14T23:00:00Z") },
        },
        NOW,
      ),
    ).toEqual({ tone: "warning", label: "Bloqué jusqu'au 15/11/2026 00:00", suspended: true });
    expect(accountStatus({ ...ACCOUNT, state: { ...ACCOUNT.state, blockedAt } }, NOW)).toEqual({
      tone: "danger",
      label: "Bloqué",
      suspended: true,
    });
  });

  it("blocage expiré : actif", () => {
    expect(
      accountStatus(
        {
          ...ACCOUNT,
          state: {
            ...ACCOUNT.state,
            blockedAt: new Date("2026-11-01T00:00:00Z"),
            blockedUntil: new Date("2026-11-02T00:00:00Z"),
          },
        },
        NOW,
      ).label,
    ).toBe("Actif");
  });

  it("suppression programmée : rouge, avec la date", () => {
    expect(
      accountStatus(
        {
          ...ACCOUNT,
          state: { ...ACCOUNT.state, deletionDueAt: new Date("2026-12-08T19:00:00Z") },
        },
        NOW,
      ),
    ).toEqual({ tone: "danger", label: "Suppression le 08/12/2026 20:00", suspended: true });
  });
});

describe("accountTimeline", () => {
  it("création et dernière activité", () => {
    expect(accountTimeline(ACCOUNT)).toBe("Créé le 05/01/2026 10:00 · jamais connecté");
    expect(accountTimeline({ ...ACCOUNT, lastSeenAt: new Date("2026-11-07T07:30:00Z") })).toBe(
      "Créé le 05/01/2026 10:00 · dernière activité le 07/11/2026 08:30",
    );
  });
});

describe("accountContentsLabel", () => {
  it("singulier, pluriel, types vides omis", () => {
    expect(
      accountContentsLabel({ compensations: 12, games: 1, notes: 0, scales: 0, colleagues: 3 }),
    ).toBe("12 indemnités, 1 match, 3 collègues");
    expect(
      accountContentsLabel({ compensations: 0, games: 0, notes: 0, scales: 0, colleagues: 0 }),
    ).toBeNull();
  });
});

describe("suspendedCountLabel", () => {
  it("rien si aucun compte coupé", () => {
    expect(suspendedCountLabel(0)).toBeNull();
    expect(suspendedCountLabel(1)).toBe("1 compte coupé");
    expect(suspendedCountLabel(3)).toBe("3 comptes coupés");
  });
});
