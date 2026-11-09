import { describe, expect, it } from "vitest";
import type { InvitationSummary } from "@/server/db/invitations";
import { invitationCounts, invitationTimeline } from "./invitation-labels";

const base: InvitationSummary = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "a@example.test",
  createdAt: new Date("2026-11-05T09:00:00Z"),
  expiresAt: new Date("2026-11-08T09:00:00Z"),
  acceptedAt: null,
  revokedAt: null,
  status: "pending",
};

describe("invitationTimeline", () => {
  it("en attente : date d'envoi puis d'expiration", () => {
    expect(invitationTimeline(base)).toMatch(/^Envoyée le 05\/11\/2026.* · expire le 08\/11\/2026/);
  });

  it("acceptée et révoquée : la date de l'événement", () => {
    expect(
      invitationTimeline({
        ...base,
        status: "accepted",
        acceptedAt: new Date("2026-11-06T10:00:00Z"),
      }),
    ).toMatch(/ · acceptée le 06\/11\/2026/);
    expect(
      invitationTimeline({
        ...base,
        status: "revoked",
        revokedAt: new Date("2026-11-07T10:00:00Z"),
      }),
    ).toMatch(/ · révoquée le 07\/11\/2026/);
  });

  it("expirée : la date d'expiration", () => {
    expect(invitationTimeline({ ...base, status: "expired" })).toMatch(
      / · expirée le 08\/11\/2026/,
    );
  });
});

describe("invitationCounts", () => {
  it("compte les invitations en attente et le total, au singulier comme au pluriel", () => {
    expect(invitationCounts([base])).toBe("1 en attente · 1 invitation");
    expect(invitationCounts([base, base, { ...base, status: "expired" }])).toBe(
      "2 en attente · 3 invitations",
    );
    expect(invitationCounts([])).toBe("0 en attente · 0 invitation");
  });
});
