import { describe, expect, it } from "vitest";
import { fr } from "@/i18n/fr";
import { fieldError, scaleStatusMessage } from "./scale-messages";

const t = fr.scales;

describe("scaleStatusMessage", () => {
  it("n'affiche rien au repos", () => {
    expect(scaleStatusMessage("idle")).toBeNull();
  });

  it("laisse les champs porter l'erreur quand ils sont identifiés", () => {
    expect(scaleStatusMessage("invalid", { invalidFields: ["name"] })).toBeNull();
  });

  it("affiche une erreur générale si aucun champ précis n'est en cause", () => {
    expect(scaleStatusMessage("invalid", { invalidFields: [] })).toEqual({
      tone: "error",
      text: t.errors.invalid,
    });
  });

  it("distingue la limite de barèmes et la limite de lignes", () => {
    expect(scaleStatusMessage("limit_reached")?.text).toBe(t.errors.scaleLimit);
    expect(scaleStatusMessage("limit_reached", { limit: "rate" })?.text).toBe(t.errors.rateLimit);
  });

  it("annonce les succès avec le bon ton", () => {
    expect(scaleStatusMessage("added")).toEqual({ tone: "success", text: t.addRate.added });
    expect(scaleStatusMessage("archived")?.tone).toBe("success");
  });

  it("explique pourquoi une ligne ne peut pas être supprimée", () => {
    expect(scaleStatusMessage("in_use")?.text).toBe(t.errors.rateInUse);
    expect(scaleStatusMessage("last_rate")?.text).toBe(t.errors.lastRate);
  });
});

describe("fieldError", () => {
  it("renvoie le message du champ en erreur", () => {
    expect(fieldError("ratePerKm", ["gameAmount", "ratePerKm"])).toBe(t.errors.ratePerKm);
  });

  it("renvoie null pour un champ valide", () => {
    expect(fieldError("name", ["gameAmount"])).toBeNull();
  });
});