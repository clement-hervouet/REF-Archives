import { describe, expect, it } from "vitest";
import { fr } from "@/i18n/fr";
import {
  clubFieldError,
  clubStatusMessage,
  clubVenueFieldError,
  clubVenueStatusMessage,
} from "./club-messages";

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

describe("clubVenueStatusMessage", () => {
  it("compte les salles ajoutées et signale les refus", () => {
    expect(clubVenueStatusMessage({ status: "idle" })).toBeNull();
    expect(clubVenueStatusMessage({ status: "added", count: 1 })).toEqual({
      tone: "success",
      text: fr.clubs.venues.addedOne,
    });
    expect(clubVenueStatusMessage({ status: "added", count: 3 })?.text).toBe("3 salles ajoutées.");
    expect(clubVenueStatusMessage({ status: "full" })?.tone).toBe("error");
    expect(clubVenueStatusMessage({ status: "invalid", fields: ["venues"] })?.text).toBe(
      fr.clubs.errors.venues,
    );
  });
});

describe("clubVenueFieldError", () => {
  it("ne signale que les champs refusés", () => {
    const state = { status: "invalid", fields: ["name", "postalCode"] } as const;
    expect(clubVenueFieldError("name", state)).toBe(fr.clubs.errors.venueName);
    expect(clubVenueFieldError("postalCode", state)).toBe(fr.compensations.errors.postalCode);
    expect(clubVenueFieldError("street", state)).toBeNull();
  });
});
