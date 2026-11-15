import { describe, expect, it } from "vitest";
import { fr } from "@/i18n/fr";
import { clubFieldError, clubStatusMessage } from "./club-messages";

describe("clubStatusMessage", () => {
  it("annonce les succès et les erreurs", () => {
    expect(clubStatusMessage({ status: "idle" })).toBeNull();
    expect(clubStatusMessage({ status: "created" })?.tone).toBe("success");
    expect(clubStatusMessage({ status: "limit_reached" })).toEqual({
      tone: "error",
      text: fr.compensations.errors.clubLimit,
    });
  });
});

describe("clubFieldError", () => {
  it("ne signale que les champs refusés", () => {
    const state = { status: "invalid", fields: ["postalCode", "street"] } as const;
    expect(clubFieldError("postalCode", state)).toBe(fr.compensations.errors.postalCode);
    expect(clubFieldError("street", state)).toBe(fr.clubs.errors.street);
    expect(clubFieldError("name", state)).toBeNull();
    expect(clubFieldError("name", { status: "idle" })).toBeNull();
  });
});
