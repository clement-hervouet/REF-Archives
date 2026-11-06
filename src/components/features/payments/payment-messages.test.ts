import { describe, expect, it } from "vitest";
import { fr } from "@/i18n/fr";
import { markPaidMessage, paymentIssueMessages, selectionLabel } from "./payment-messages";

describe("markPaidMessage", () => {
  it("n'affiche rien avant l'envoi ni pour une saisie invalide (détail à part)", () => {
    expect(markPaidMessage({ status: "idle" })).toBeNull();
    expect(markPaidMessage({ status: "invalid", issues: ["no_selection"] })).toBeNull();
  });

  it("confirme au singulier et au pluriel, avec la date au format français", () => {
    expect(markPaidMessage({ status: "marked", count: 1, paidOn: "2026-11-04" })).toEqual({
      tone: "success",
      text: "1 indemnité marquée payée le 04/11/2026.",
    });
    expect(markPaidMessage({ status: "marked", count: 3, paidOn: "2026-11-04" })?.text).toBe(
      "3 indemnités marquées payées le 04/11/2026.",
    );
  });

  it("signale qu'aucune indemnité n'a changé", () => {
    expect(markPaidMessage({ status: "unchanged" })).toEqual({
      tone: "error",
      text: fr.payments.unchanged,
    });
  });
});

describe("paymentIssueMessages", () => {
  it("traduit chaque erreur", () => {
    expect(paymentIssueMessages(["no_selection", "future_date"])).toEqual([
      fr.payments.errors.noSelection,
      fr.payments.errors.futureDate,
    ]);
  });
});

describe("selectionLabel", () => {
  it("décrit la sélection", () => {
    expect(selectionLabel(0, 0)).toBe(fr.payments.selectionNone);
    expect(selectionLabel(1, 3960)).toMatch(/^1 indemnité sélectionnée : 39,60\s€$/u);
    expect(selectionLabel(2, 10_715)).toMatch(/^2 indemnités sélectionnées : 107,15\s€$/u);
  });
});
