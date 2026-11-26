import { describe, expect, it } from "vitest";
import { IMPROVEMENT_AXES } from "@/lib/improvement-axes-fields";
import {
  buildAxisList,
  findCustomAxis,
  hiddenAxes,
  removeAxis,
  reorderAxisList,
  restoreAxis,
  sameLabel,
  visibleAxes,
} from "./axis-list";
import type { ImprovementAxisRow } from "./axis-list";

const CUSTOM_ID = "6b1f0e44-2c55-4d3e-9a51-0f4c2d8e7a10";

const ROWS: ImprovementAxisRow[] = [
  { id: "a", defaultKey: "signals", label: null, position: 2, body: "Bras tendus", hidden: false },
  {
    id: CUSTOM_ID,
    defaultKey: null,
    label: "Gestion des bancs",
    position: 0,
    body: null,
    hidden: false,
  },
  { id: "b", defaultKey: "foulJudgment", label: null, position: 1, body: null, hidden: false },
];

describe("buildAxisList", () => {
  it("donne les axes par défaut, dans l'ordre par défaut, sans enregistrement", () => {
    const list = buildAxisList([]);
    expect(list.map((item) => item.slot)).toEqual([...IMPROVEMENT_AXES]);
    expect(list.every((item) => item.body === null && item.label === null)).toBe(true);
  });

  it("range les lignes par position (catégories comprises), puis ajoute les axes sans ligne", () => {
    const list = buildAxisList(ROWS);
    expect(list.map((item) => item.slot)).toEqual([
      CUSTOM_ID,
      "foulJudgment",
      "signals",
      "mechanicsAk",
      "mechanicsAt",
      "mechanicsTransitions",
      "decisionMaking",
      "violationJudgment",
      "management",
    ]);
    expect(list[0]).toEqual({
      slot: CUSTOM_ID,
      defaultKey: null,
      label: "Gestion des bancs",
      body: null,
      hidden: false,
    });
    expect(list[2]).toEqual({
      slot: "signals",
      defaultKey: "signals",
      label: null,
      body: "Bras tendus",
      hidden: false,
    });
  });
});

describe("reorderAxisList", () => {
  const list = buildAxisList([]);
  const reversed = [...IMPROVEMENT_AXES].reverse();

  it("range la liste selon l'ordre envoyé, textes compris", () => {
    const withText = list.map((item) =>
      item.slot === "signals" ? { ...item, body: "Bras tendus" } : item,
    );
    const result = reorderAxisList(withText, reversed);
    expect(result?.map((item) => item.slot)).toEqual(reversed);
    expect(result?.find((item) => item.slot === "signals")?.body).toBe("Bras tendus");
  });

  it("refuse un axe manquant, en double ou inconnu", () => {
    expect(reorderAxisList(list, reversed.slice(1))).toBeNull();
    expect(reorderAxisList(list, [...reversed.slice(1), reversed[1] ?? ""])).toBeNull();
    expect(reorderAxisList(list, [...reversed.slice(1), "inconnu"])).toBeNull();
  });
});

describe("findCustomAxis", () => {
  const list = buildAxisList(ROWS);

  it("trouve une catégorie personnelle, jamais un axe par défaut", () => {
    expect(findCustomAxis(list, CUSTOM_ID)?.label).toBe("Gestion des bancs");
    expect(findCustomAxis(list, "signals")).toBeUndefined();
    expect(findCustomAxis(list, "inconnu")).toBeUndefined();
  });
});

describe("sameLabel", () => {
  it("ignore la casse, accents compris", () => {
    expect(sameLabel("Méca AK", "MÉCA ak")).toBe(true);
    expect(sameLabel("Méca AK", "Meca AK")).toBe(false);
  });
});

describe("axes par défaut supprimés", () => {
  const withHidden = buildAxisList([
    { id: "h", defaultKey: "signals", label: null, position: 0, body: null, hidden: true },
  ]);
  const slots = (items: readonly { slot: string }[]) => items.map((item) => item.slot);

  it("ne sont ni affichés ni rajoutés, mais restent à rétablir", () => {
    expect(slots(visibleAxes(withHidden))).not.toContain("signals");
    expect(slots(visibleAxes(withHidden))).toHaveLength(IMPROVEMENT_AXES.length - 1);
    expect(slots(hiddenAxes(withHidden))).toEqual(["signals"]);
  });

  it("ne comptent pas dans l'ordre et restent en fin de liste", () => {
    const order = slots(visibleAxes(withHidden)).reverse();
    const result = reorderAxisList(withHidden, order);
    expect(result === null ? null : slots(result)).toEqual([...order, "signals"]);
    expect(reorderAxisList(withHidden, [...order, "signals"])).toBeNull();
  });

  it("removeAxis masque un axe par défaut (texte effacé) et retire une catégorie", () => {
    const list = buildAxisList(ROWS);
    const fromDefault = removeAxis(list, "signals");
    const hidden = fromDefault?.list.at(-1);
    expect(hidden).toEqual({
      slot: "signals",
      defaultKey: "signals",
      label: null,
      body: null,
      hidden: true,
    });
    expect(fromDefault?.list).toHaveLength(list.length);
    const fromCustom = removeAxis(list, CUSTOM_ID);
    expect(fromCustom?.list.map((item) => item.slot)).not.toContain(CUSTOM_ID);
    expect(fromCustom?.removed.label).toBe("Gestion des bancs");
    expect(removeAxis(withHidden, "signals")).toBeNull();
    expect(removeAxis(list, "inconnu")).toBeNull();
  });

  it("restoreAxis remet l'axe à la fin des axes visibles", () => {
    const restored = restoreAxis(withHidden, "signals");
    expect(restored?.at(-1)).toMatchObject({ slot: "signals", hidden: false });
    expect(restoreAxis(withHidden, "mechanicsAk")).toBeNull();
  });
});
