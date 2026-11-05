import { describe, expect, it } from "vitest";
import { fr } from "@/i18n/fr";
import { profileFieldError, profileStateMessage } from "./profile-messages";

describe("profileFieldError", () => {
  it("renvoie l'erreur du champ demandé seulement", () => {
    const issues = ["firstname.required", "lastname.too_long"] as const;
    expect(profileFieldError(issues, "firstname")).toBe(fr.profile.errors.firstnameRequired);
    expect(profileFieldError(issues, "lastname")).toBe(fr.profile.errors.lastnameTooLong);
  });

  it("renvoie null quand le champ n'a pas d'erreur", () => {
    expect(profileFieldError(["lastname.invalid"], "firstname")).toBeNull();
    expect(profileFieldError([], "lastname")).toBeNull();
  });
});

describe("profileStateMessage", () => {
  it("n'affiche rien avant le premier envoi", () => {
    expect(profileStateMessage({ status: "idle" })).toBeNull();
  });

  it("confirme l'enregistrement", () => {
    expect(profileStateMessage({ status: "saved" })).toEqual({
      tone: "success",
      text: fr.profile.settings.saved,
    });
  });

  it("signale une saisie invalide ou un compte introuvable", () => {
    expect(profileStateMessage({ status: "invalid", issues: [] })?.tone).toBe("error");
    expect(profileStateMessage({ status: "not_found" })).toEqual({
      tone: "error",
      text: fr.profile.errors.notFound,
    });
  });
});
