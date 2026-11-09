import { describe, expect, it, vi } from "vitest";
import { groupByPayer, handleClearPayment, handleMarkPaid, summarizeUnpaid } from "./payments";
import type { ClearPaymentDeps, MarkPaidDeps } from "./payments";

const USER_ID = "3f0c1d52-9b0a-4c55-8a3e-2f6f3a1c9e11";
const ID1 = "4d5e6f7a-8b9c-4d0e-8f1a-2b3c4d5e6f01";
const ID2 = "4d5e6f7a-8b9c-4d0e-8f1a-2b3c4d5e6f02";
const TODAY = "2026-11-06";

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

describe("summarizeUnpaid", () => {
  it("additionne les montants (match + kilométrage arrondi) et garde la plus ancienne", () => {
    const rows = [
      { id: "a", gameAmountCents: 3000, centsPerKm: "40.00", distanceM: 24_000 }, // 30 + 9,60
      { id: "b", gameAmountCents: 4800, centsPerKm: "42.50", distanceM: 46_000 }, // 48 + 19,55
    ];
    expect(summarizeUnpaid(rows)).toEqual({ count: 2, totalCents: 10_715, oldest: rows[0] });
  });

  it("renvoie un résumé vide sans indemnité en attente", () => {
    expect(summarizeUnpaid([])).toEqual({ count: 0, totalCents: 0, oldest: null });
  });
});

describe("handleMarkPaid", () => {
  function setup(count: number) {
    const markPaid = vi.fn<MarkPaidDeps["markPaid"]>().mockResolvedValue(count);
    return { deps: { markPaid } satisfies MarkPaidDeps, markPaid };
  }

  it("valide la sélection pour l'utilisateur de la session", async () => {
    const { deps, markPaid } = setup(2);
    expect(await handleMarkPaid(deps, USER_ID, form([ID1, ID2], "2026-11-04"), TODAY)).toEqual({
      status: "marked",
      count: 2,
      paidOn: "2026-11-04",
    });
    expect(markPaid).toHaveBeenCalledWith({
      userId: USER_ID,
      compensationIds: [ID1, ID2],
      paidOn: "2026-11-04",
    });
  });

  it("ignore un identifiant d'utilisateur glissé dans le formulaire", async () => {
    const { deps, markPaid } = setup(1);
    const data = form([ID1], TODAY);
    data.set("userId", "9d6c2f4e-1b7a-4e0c-9a55-0c2d7f1e8b33");
    await handleMarkPaid(deps, USER_ID, data, TODAY);
    expect(markPaid.mock.lastCall?.[0].userId).toBe(USER_ID);
  });

  it("renvoie les erreurs sans rien enregistrer", async () => {
    const { deps, markPaid } = setup(1);
    expect(await handleMarkPaid(deps, USER_ID, form([], "2026-12-01"), TODAY)).toEqual({
      status: "invalid",
      issues: ["no_selection", "future_date"],
    });
    expect(markPaid).not.toHaveBeenCalled();
  });

  it("signale qu'aucune indemnité n'a changé (déjà payées ou supprimées entre-temps)", async () => {
    const { deps } = setup(0);
    expect(await handleMarkPaid(deps, USER_ID, form([ID1], TODAY), TODAY)).toEqual({
      status: "unchanged",
    });
  });
});

describe("handleClearPayment", () => {
  function setup(cleared: boolean) {
    const clearPayment = vi.fn<ClearPaymentDeps["clearPayment"]>().mockResolvedValue(cleared);
    return { deps: { clearPayment } satisfies ClearPaymentDeps, clearPayment };
  }

  it("annule le paiement de l'indemnité de l'utilisateur", async () => {
    const { deps, clearPayment } = setup(true);
    expect(await handleClearPayment(deps, USER_ID, form([ID1]))).toEqual({ status: "cleared" });
    expect(clearPayment).toHaveBeenCalledWith({ userId: USER_ID, compensationId: ID1 });
  });

  it("refuse un identifiant mal formé sans toucher à la base", async () => {
    const { deps, clearPayment } = setup(true);
    expect(await handleClearPayment(deps, USER_ID, form(["x"]))).toEqual({ status: "not_found" });
    expect(clearPayment).not.toHaveBeenCalled();
  });

  it("signale une indemnité introuvable ou non payée", async () => {
    const { deps } = setup(false);
    expect(await handleClearPayment(deps, USER_ID, form([ID1]))).toEqual({ status: "not_found" });
  });
});

describe("groupByPayer", () => {
  const rate = { gameAmountCents: 3000, centsPerKm: "40.00", distanceM: 24_000 }; // 39,60 €
  const cd35 = { kind: "committee", department: "35" } as const;
  const bzh = { kind: "league", league: "bretagne" } as const;

  it("regroupe par organisme, garde l'ordre des dates, additionne chaque groupe", () => {
    const groups = groupByPayer([
      { ...rate, id: "a", payer: bzh },
      { ...rate, id: "b", payer: cd35 },
      { ...rate, id: "c", payer: cd35 },
      { ...rate, id: "d", payer: null },
      { ...rate, id: "e", payer: { kind: "federation" } as const },
    ]);
    expect(
      groups.map((group) => [group.label, group.rows.map((row) => row.id), group.totalCents]),
    ).toEqual([
      ["CD35", ["b", "c"], 7920],
      ["Ligue de Bretagne", ["a"], 3960],
      ["Fédération", ["e"], 3960],
      ["Organisme inconnu", ["d"], 3960],
    ]);
    expect(groups[0]?.key).toBe("cd-35");
    expect(groups[3]?.key).toBe("unknown");
  });

  it("renvoie une liste vide sans indemnité", () => {
    expect(groupByPayer([])).toEqual([]);
  });
});
