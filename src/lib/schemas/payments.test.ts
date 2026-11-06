import { describe, expect, it } from "vitest";
import { MAX_PAYMENT_SELECTION, parseClearPaymentForm, parsePaymentForm } from "./payments";

const TODAY = "2026-11-06";
const ID1 = "3f0c1d52-9b0a-4c55-8a3e-2f6f3a1c9e11";
const ID2 = "9d6c2f4e-1b7a-4e0c-9a55-0c2d7f1e8b33";

function form(ids: string[], paidOn?: string): FormData {
  const data = new FormData();
  for (const id of ids) {
    data.append("compensationId", id);
  }
  if (paidOn !== undefined) {
    data.set("paidOn", paidOn);
  }
  return data;
}

function uuid(n: number): string {
  return `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
}

describe("parsePaymentForm", () => {
  it("accepte une sélection et une date passée ou du jour", () => {
    expect(parsePaymentForm(form([ID1, ID2], "2026-11-02"), TODAY)).toEqual({
      success: true,
      selection: { compensationIds: [ID1, ID2], paidOn: "2026-11-02" },
    });
    expect(parsePaymentForm(form([ID1], TODAY), TODAY).success).toBe(true);
  });

  it("retire les doublons", () => {
    const result = parsePaymentForm(form([ID1, ID1, ID2], TODAY), TODAY);
    expect(result.success && result.selection.compensationIds).toEqual([ID1, ID2]);
  });

  it("refuse une sélection vide", () => {
    expect(parsePaymentForm(form([], TODAY), TODAY)).toEqual({
      success: false,
      issues: ["no_selection"],
    });
  });

  it("refuse un identifiant mal formé", () => {
    expect(parsePaymentForm(form([ID1, "' OR 1=1 --"], TODAY), TODAY)).toEqual({
      success: false,
      issues: ["invalid_selection"],
    });
  });

  it("refuse plus de 500 indemnités, et accepte exactement 500", () => {
    const many = Array.from({ length: MAX_PAYMENT_SELECTION + 1 }, (_, i) => uuid(i + 1));
    expect(parsePaymentForm(form(many, TODAY), TODAY)).toEqual({
      success: false,
      issues: ["too_many"],
    });
    expect(parsePaymentForm(form(many.slice(1), TODAY), TODAY).success).toBe(true);
  });

  it("refuse une date future, mal formée, inexistante ou trop ancienne", () => {
    expect(parsePaymentForm(form([ID1], "2026-11-07"), TODAY)).toEqual({
      success: false,
      issues: ["future_date"],
    });
    for (const paidOn of ["", "06/11/2026", "2026-02-30", "1999-12-31"]) {
      expect(parsePaymentForm(form([ID1], paidOn), TODAY)).toEqual({
        success: false,
        issues: ["invalid_date"],
      });
    }
    expect(parsePaymentForm(form([ID1]), TODAY)).toEqual({
      success: false,
      issues: ["invalid_date"],
    });
  });

  it("renvoie les deux erreurs à la fois", () => {
    expect(parsePaymentForm(form([], "2030-01-01"), TODAY)).toEqual({
      success: false,
      issues: ["no_selection", "future_date"],
    });
  });
});

describe("parseClearPaymentForm", () => {
  it("lit un identifiant valide", () => {
    expect(parseClearPaymentForm(form([ID1]))).toBe(ID1);
  });

  it("refuse un identifiant absent ou mal formé", () => {
    expect(parseClearPaymentForm(form([]))).toBeNull();
    expect(parseClearPaymentForm(form(["abc"]))).toBeNull();
  });
});
