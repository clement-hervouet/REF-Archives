import { describe, expect, it } from "vitest";
import { ValidationError } from "@/lib/errors";
import { findEffectiveRate } from "./effective-rate";

const rates = [
  { id: "septembre", effectiveFrom: "2026-09-01" },
  { id: "janvier", effectiveFrom: "2026-01-01" },
  { id: "janvier-2027", effectiveFrom: "2027-01-01" },
];

describe("findEffectiveRate", () => {
  it("prend la ligne la plus récente avant la date, même si la liste n'est pas triée", () => {
    expect(findEffectiveRate(rates, "2026-11-14")?.id).toBe("septembre");
  });

  it("applique une ligne dès son jour d'application", () => {
    expect(findEffectiveRate(rates, "2026-09-01")?.id).toBe("septembre");
  });

  it("garde l'ancienne ligne la veille d'un changement", () => {
    expect(findEffectiveRate(rates, "2026-08-31")?.id).toBe("janvier");
  });

  it("ignore une ligne future", () => {
    expect(findEffectiveRate(rates, "2026-12-31")?.id).toBe("septembre");
  });

  it("utilise une ligne future une fois sa date atteinte", () => {
    expect(findEffectiveRate(rates, "2027-03-01")?.id).toBe("janvier-2027");
  });

  it("renvoie null avant la première ligne", () => {
    expect(findEffectiveRate(rates, "2025-12-31")).toBeNull();
  });

  it("renvoie null pour un barème sans ligne", () => {
    expect(findEffectiveRate([], "2026-11-14")).toBeNull();
  });

  it("lève une ValidationError si la date demandée est invalide", () => {
    expect(() => findEffectiveRate(rates, "14/11/2026")).toThrow(ValidationError);
  });

  it("lève une ValidationError si une ligne a une date invalide", () => {
    expect(() => findEffectiveRate([{ effectiveFrom: "2026-02-30" }], "2026-11-14")).toThrow(
      ValidationError,
    );
  });
});