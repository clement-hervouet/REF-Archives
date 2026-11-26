import { describe, expect, it } from "vitest";
import { IMPROVEMENT_AXES, IMPROVEMENT_CUSTOM_MAX } from "@/lib/improvement-axes-fields";
import { makeFakeDb } from "../db/fake-db";
import type { Queryable } from "../db/users";
import { buildAxisList } from "./axis-list";
import {
  handleCreateImprovementAxis,
  handleDeleteImprovementAxis,
  handleRenameImprovementAxis,
  handleReorderImprovementAxes,
  handleRestoreImprovementAxis,
  handleSaveImprovementAxes,
  improvementAxesFormValues,
} from "./manage-improvement-axes";
import type { ImprovementAxesDeps } from "./manage-improvement-axes";

const USER_ID = "3f0c1d52-9b0a-4c55-8a3e-2f6f3a1c9e11";
const CUSTOM_ID = "6b1f0e44-2c55-4d3e-9a51-0f4c2d8e7a10";
const OTHER_ID = "0d6c3a1e-7f2b-4e8a-b5c9-1a2b3c4d5e6f";
const UPDATED_AT = new Date("2026-11-20T10:00:00Z");
/** Position de la première catégorie personnelle, après les axes par défaut. */
const CUSTOM_START = IMPROVEMENT_AXES.length;
const NOT_HIDDEN = IMPROVEMENT_AXES.map(() => false);

/** Requêtes : verrou, lecture des lignes (`rows`), puis écritures. */
function setup(rows: Record<string, unknown>[] = []) {
  const { db, query } = makeFakeDb();
  query
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows })
    .mockResolvedValue({ rows: [] });
  const deps = {
    transaction: <T>(action: (tx: Queryable) => Promise<T>) => action(db),
  } satisfies ImprovementAxesDeps;
  return { deps, query };
}

let nextId = 0;

function row(defaultKey: string, position: number, body: string | null = null, hidden = false) {
  nextId += 1;
  const id = `00000000-0000-4000-8000-${String(nextId).padStart(12, "0")}`;
  return {
    id,
    default_key: defaultKey,
    label: null,
    hidden,
    position,
    body,
    updated_at: UPDATED_AT,
  };
}

function custom(id: string, label: string, position: number, body: string | null = null) {
  return { id, default_key: null, label, hidden: false, position, body, updated_at: UPDATED_AT };
}

/** Les 7 axes par défaut enregistrés, dans l'ordre par défaut, puis `extra`. */
function savedRows(...extra: Record<string, unknown>[]) {
  return [...IMPROVEMENT_AXES.map((key, index) => row(key, index)), ...extra];
}

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(entries)) {
    data.set(name, value);
  }
  return data;
}

function orderForm(slots: readonly string[]): FormData {
  const data = new FormData();
  for (const slot of slots) {
    data.append("order", slot);
  }
  return data;
}

describe("handleSaveImprovementAxes", () => {
  it("verrouille, puis enregistre les textes nettoyés dans l'ordre par défaut", async () => {
    const { deps, query } = setup();
    const state = await handleSaveImprovementAxes(
      deps,
      USER_ID,
      form({ mechanicsAk: "  Rotation trop tardive.\r\n", foulJudgment: "Écrans" }),
    );
    expect(state).toEqual({ status: "saved" });
    expect(query).toHaveBeenCalledTimes(3);
    expect(query.mock.calls[0]?.[0]).toContain("pg_advisory_xact_lock");
    expect(query.mock.calls[2]?.[1]).toEqual([
      USER_ID,
      [...IMPROVEMENT_AXES],
      [0, 1, 2, 3, 4, 5, 6, 7],
      ["Rotation trop tardive.", null, null, null, null, "Écrans", null, null],
      NOT_HIDDEN,
    ]);
  });

  it("garde l'ordre enregistré et les textes des axes absents du formulaire", async () => {
    const { deps, query } = setup([
      row("signals", 0, "Bras tendus"),
      row("mechanicsAk", 1, "Ancien"),
    ]);
    expect(await handleSaveImprovementAxes(deps, USER_ID, form({ mechanicsAk: "" }))).toEqual({
      status: "saved",
    });
    const [, keys, positions, bodies] = query.mock.calls[2]?.[1] ?? [];
    expect(keys).toEqual([
      "signals",
      "mechanicsAk",
      "mechanicsAt",
      "mechanicsTransitions",
      "decisionMaking",
      "foulJudgment",
      "violationJudgment",
      "management",
    ]);
    expect(positions).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(bodies).toEqual(["Bras tendus", null, null, null, null, null, null, null]);
  });

  it("enregistre le texte d'une catégorie personnelle par son identifiant", async () => {
    const { deps, query } = setup([custom(CUSTOM_ID, "Bancs", 0)]);
    await handleSaveImprovementAxes(deps, USER_ID, form({ [CUSTOM_ID]: "Coachs debout" }));
    expect(query).toHaveBeenCalledTimes(4);
    expect(query.mock.calls[3]?.[0]).toContain("UPDATE improvement_axis");
    expect(query.mock.calls[3]?.[1]).toEqual([USER_ID, [CUSTOM_ID], [0], ["Coachs debout"]]);
    // Les axes par défaut viennent après la catégorie.
    expect(query.mock.calls[2]?.[1]?.[2]).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("refuse un texte trop long sans rien écrire", async () => {
    const { deps, query } = setup();
    const state = await handleSaveImprovementAxes(
      deps,
      USER_ID,
      form({ decisionMaking: "a".repeat(4097), signals: "ok" }),
    );
    expect(state).toEqual({ status: "invalid", fields: ["decisionMaking"] });
    expect(query).toHaveBeenCalledTimes(2);
  });

  it("refuse un caractère de contrôle", async () => {
    const { deps } = setup();
    const state = await handleSaveImprovementAxes(deps, USER_ID, form({ mechanicsAt: "a\u0000b" }));
    expect(state).toEqual({ status: "invalid", fields: ["mechanicsAt"] });
  });
});

describe("handleReorderImprovementAxes", () => {
  const reversed = [...IMPROVEMENT_AXES].reverse();

  it("réécrit les positions dans l'ordre envoyé, textes inchangés", async () => {
    const { deps, query } = setup([row("signals", 4, "Bras tendus")]);
    expect(await handleReorderImprovementAxes(deps, USER_ID, orderForm(reversed))).toEqual({
      status: "reordered",
    });
    expect(query.mock.calls[0]?.[0]).toContain("pg_advisory_xact_lock");
    const [, keys, positions, bodies] = query.mock.calls[2]?.[1] ?? [];
    expect(keys).toEqual(reversed);
    expect(positions).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(bodies).toEqual([null, null, null, "Bras tendus", null, null, null, null]);
  });

  it("range une catégorie personnelle parmi les axes par défaut", async () => {
    const { deps, query } = setup(savedRows(custom(CUSTOM_ID, "Bancs", CUSTOM_START)));
    const order = [IMPROVEMENT_AXES[0], CUSTOM_ID, ...IMPROVEMENT_AXES.slice(1)];
    expect(await handleReorderImprovementAxes(deps, USER_ID, orderForm(order))).toEqual({
      status: "reordered",
    });
    expect(query.mock.calls[2]?.[1]?.[2]).toEqual([0, 2, 3, 4, 5, 6, 7, 8]);
    expect(query.mock.calls[3]?.[1]).toEqual([USER_ID, [CUSTOM_ID], [1], [null]]);
  });

  it("refuse un ordre qui ne reprend pas les axes actuels, sans rien écrire", async () => {
    const { deps, query } = setup();
    expect(await handleReorderImprovementAxes(deps, USER_ID, orderForm(reversed.slice(1)))).toEqual(
      { status: "stale" },
    );
    expect(query).toHaveBeenCalledTimes(2);
  });

  it("refuse un ordre vide sans ouvrir de transaction", async () => {
    const { deps, query } = setup();
    expect(await handleReorderImprovementAxes(deps, USER_ID, new FormData())).toEqual({
      status: "stale",
    });
    expect(query).not.toHaveBeenCalled();
  });
});

describe("handleCreateImprovementAxis", () => {
  it("crée les axes par défaut manquants, puis ajoute la catégorie en fin de liste", async () => {
    const { deps, query } = setup();
    expect(
      await handleCreateImprovementAxis(deps, USER_ID, form({ label: "  Gestion   des bancs " })),
    ).toEqual({ status: "created" });
    expect(query.mock.calls[2]?.[1]?.[1]).toEqual([...IMPROVEMENT_AXES]);
    expect(query.mock.calls[3]?.[0]).toContain("INSERT INTO improvement_axis");
    expect(query.mock.calls[3]?.[1]).toEqual([USER_ID, "Gestion des bancs", CUSTOM_START]);
  });

  it("refuse un nom vide ou trop long sans ouvrir de transaction", async () => {
    const { deps, query } = setup();
    expect(await handleCreateImprovementAxis(deps, USER_ID, form({ label: "   " }))).toEqual({
      status: "invalid",
      error: "required",
    });
    expect(
      await handleCreateImprovementAxis(deps, USER_ID, form({ label: "a".repeat(61) })),
    ).toEqual({ status: "invalid", error: "too_long" });
    expect(await handleCreateImprovementAxis(deps, USER_ID, form({ label: "a\u0000" }))).toEqual({
      status: "invalid",
      error: "invalid",
    });
    expect(query).not.toHaveBeenCalled();
  });

  it("refuse le nom d'un axe par défaut ou d'une catégorie, sans tenir compte de la casse", async () => {
    const first = setup();
    expect(
      await handleCreateImprovementAxis(first.deps, USER_ID, form({ label: "méca ak" })),
    ).toEqual({ status: "invalid", error: "duplicate" });
    const second = setup(savedRows(custom(CUSTOM_ID, "Bancs", CUSTOM_START)));
    expect(
      await handleCreateImprovementAxis(second.deps, USER_ID, form({ label: "BANCS" })),
    ).toEqual({ status: "invalid", error: "duplicate" });
    expect(second.query).toHaveBeenCalledTimes(2);
  });

  it("refuse une catégorie de plus que le maximum", async () => {
    const customs = Array.from({ length: IMPROVEMENT_CUSTOM_MAX }, (_value, index) =>
      custom(
        `00000000-0000-4000-9000-${String(index).padStart(12, "0")}`,
        `Catégorie ${String(index)}`,
        CUSTOM_START + index,
      ),
    );
    const { deps, query } = setup(savedRows(...customs));
    expect(
      await handleCreateImprovementAxis(deps, USER_ID, form({ label: "Une de trop" })),
    ).toEqual({ status: "limit" });
    expect(query).toHaveBeenCalledTimes(2);
  });
});

describe("handleRenameImprovementAxis", () => {
  it("renomme une catégorie personnelle", async () => {
    const { deps, query } = setup(savedRows(custom(CUSTOM_ID, "Bancs", CUSTOM_START)));
    expect(
      await handleRenameImprovementAxis(
        deps,
        USER_ID,
        form({ slot: CUSTOM_ID, label: "Gestion des bancs" }),
      ),
    ).toEqual({ status: "renamed" });
    expect(query.mock.calls[2]?.[0]).toContain("SET label");
    expect(query.mock.calls[2]?.[1]).toEqual([CUSTOM_ID, USER_ID, "Gestion des bancs"]);
  });

  it("accepte de changer seulement la casse de son propre nom", async () => {
    const { deps, query } = setup(savedRows(custom(CUSTOM_ID, "bancs", CUSTOM_START)));
    expect(
      await handleRenameImprovementAxis(deps, USER_ID, form({ slot: CUSTOM_ID, label: "Bancs" })),
    ).toEqual({ status: "renamed" });
    expect(query).toHaveBeenCalledTimes(3);
  });

  it("refuse le nom d'une autre catégorie", async () => {
    const { deps } = setup(
      savedRows(
        custom(CUSTOM_ID, "Bancs", CUSTOM_START),
        custom(OTHER_ID, "Table", CUSTOM_START + 1),
      ),
    );
    expect(
      await handleRenameImprovementAxis(deps, USER_ID, form({ slot: OTHER_ID, label: "bancs" })),
    ).toEqual({ status: "invalid", error: "duplicate" });
  });

  it("ne renomme jamais un axe par défaut, ni une catégorie inconnue", async () => {
    const first = setup(savedRows());
    expect(
      await handleRenameImprovementAxis(first.deps, USER_ID, form({ slot: "signals", label: "X" })),
    ).toEqual({ status: "notFound" });
    const second = setup(savedRows());
    expect(
      await handleRenameImprovementAxis(
        second.deps,
        USER_ID,
        form({ slot: CUSTOM_ID, label: "X" }),
      ),
    ).toEqual({ status: "notFound" });
    expect(second.query).toHaveBeenCalledTimes(2);
  });
});

describe("handleDeleteImprovementAxis", () => {
  it("supprime la catégorie, puis remonte les suivantes d'un rang", async () => {
    const { deps, query } = setup(
      savedRows(
        custom(CUSTOM_ID, "Bancs", CUSTOM_START, "Texte"),
        custom(OTHER_ID, "Table", CUSTOM_START + 1),
      ),
    );
    expect(await handleDeleteImprovementAxis(deps, USER_ID, form({ slot: CUSTOM_ID }))).toEqual({
      status: "deleted",
    });
    expect(query.mock.calls[2]?.[0]).toContain("DELETE FROM improvement_axis");
    expect(query.mock.calls[2]?.[1]).toEqual([CUSTOM_ID, USER_ID]);
    expect(query.mock.calls[4]?.[1]).toEqual([USER_ID, [OTHER_ID], [CUSTOM_START], [null]]);
  });

  it("masque un axe par défaut et efface son texte, sans supprimer sa ligne", async () => {
    const rows = savedRows();
    rows[4] = row("signals", 4, "Bras tendus");
    const { deps, query } = setup(rows);
    expect(await handleDeleteImprovementAxis(deps, USER_ID, form({ slot: "signals" }))).toEqual({
      status: "deleted",
    });
    expect(query).toHaveBeenCalledTimes(3);
    const [, keys, positions, bodies, hidden] = query.mock.calls[2]?.[1] ?? [];
    expect(keys).toEqual([...IMPROVEMENT_AXES.filter((key) => key !== "signals"), "signals"]);
    expect(positions).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(bodies).toEqual(IMPROVEMENT_AXES.map(() => null));
    expect(hidden).toEqual([false, false, false, false, false, false, false, true]);
  });

  it("refuse un axe déjà supprimé ou inconnu", async () => {
    const hiddenSignals = savedRows();
    hiddenSignals[4] = row("signals", 4, null, true);
    const first = setup(hiddenSignals);
    expect(
      await handleDeleteImprovementAxis(first.deps, USER_ID, form({ slot: "signals" })),
    ).toEqual({ status: "notFound" });
    const second = setup(savedRows());
    expect(
      await handleDeleteImprovementAxis(second.deps, USER_ID, form({ slot: CUSTOM_ID })),
    ).toEqual({ status: "notFound" });
    expect(second.query).toHaveBeenCalledTimes(2);
  });
});

describe("handleSaveImprovementAxes et axes supprimés", () => {
  it("n'écrit pas de texte dans un axe supprimé (formulaire périmé)", async () => {
    const rows = savedRows();
    rows[4] = row("signals", 4, null, true);
    const { deps, query } = setup(rows);
    expect(await handleSaveImprovementAxes(deps, USER_ID, form({ signals: "Texte" }))).toEqual({
      status: "saved",
    });
    const [, , , bodies] = query.mock.calls[2]?.[1] ?? [];
    expect(bodies).toEqual(IMPROVEMENT_AXES.map(() => null));
  });
});

describe("handleRestoreImprovementAxis", () => {
  it("rétablit un axe par défaut supprimé en fin de liste, texte vide", async () => {
    const rows = savedRows(custom(CUSTOM_ID, "Bancs", CUSTOM_START));
    rows[0] = row("mechanicsAk", 0, null, true);
    const { deps, query } = setup(rows);
    expect(
      await handleRestoreImprovementAxis(deps, USER_ID, form({ slot: "mechanicsAk" })),
    ).toEqual({ status: "restored" });
    const [, keys, positions, , hidden] = query.mock.calls[2]?.[1] ?? [];
    expect(keys).toEqual([...IMPROVEMENT_AXES.slice(1), "mechanicsAk"]);
    // La catégorie personnelle (position 7) passe avant l'axe rétabli (position 8).
    expect(positions).toEqual([0, 1, 2, 3, 4, 5, 6, 8]);
    expect(hidden).toEqual(NOT_HIDDEN);
    expect(query.mock.calls[3]?.[1]).toEqual([USER_ID, [CUSTOM_ID], [7], [null]]);
  });

  it("refuse un axe visible ou une catégorie personnelle", async () => {
    const first = setup(savedRows());
    expect(
      await handleRestoreImprovementAxis(first.deps, USER_ID, form({ slot: "signals" })),
    ).toEqual({ status: "notFound" });
    const second = setup(savedRows(custom(CUSTOM_ID, "Bancs", CUSTOM_START)));
    expect(
      await handleRestoreImprovementAxis(second.deps, USER_ID, form({ slot: CUSTOM_ID })),
    ).toEqual({ status: "notFound" });
    expect(second.query).toHaveBeenCalledTimes(2);
  });
});

describe("improvementAxesFormValues", () => {
  it("donne un texte par axe, vide sans texte enregistré", () => {
    const values = improvementAxesFormValues(
      buildAxisList([
        {
          id: "x",
          defaultKey: "mechanicsAt",
          label: null,
          position: 0,
          body: "Placement",
          hidden: false,
        },
        {
          id: CUSTOM_ID,
          defaultKey: null,
          label: "Bancs",
          position: 1,
          body: "Coachs",
          hidden: false,
        },
      ]),
    );
    expect(values.mechanicsAt).toBe("Placement");
    expect(values[CUSTOM_ID]).toBe("Coachs");
    expect(values.mechanicsAk).toBe("");
    expect(Object.keys(values)).toHaveLength(IMPROVEMENT_AXES.length + 1);
  });
});
