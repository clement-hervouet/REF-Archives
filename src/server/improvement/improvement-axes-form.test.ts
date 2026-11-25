import { describe, expect, it } from "vitest";
import { makeFakeDb } from "../db/fake-db";
import {
  handleSaveImprovementAxes,
  improvementAxesFormValues,
  readImprovementAxesFormData,
} from "./improvement-axes-form";

const USER_ID = "3f0c1d52-9b0a-4c55-8a3e-2f6f3a1c9e11";

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(entries)) {
    data.set(name, value);
  }
  return data;
}

describe("readImprovementAxesFormData", () => {
  it("lit chaque axe, vide s'il est absent", () => {
    expect(readImprovementAxesFormData(form({ signals: "Bras tendus" }))).toEqual({
      mechanicsAk: "",
      mechanicsAt: "",
      mechanicsTransitions: "",
      decisionMaking: "",
      signals: "Bras tendus",
      foulJudgment: "",
      violationJudgment: "",
    });
  });
});

describe("handleSaveImprovementAxes", () => {
  it("enregistre les textes nettoyés, les champs vides en NULL", async () => {
    const { db, query } = makeFakeDb();
    const state = await handleSaveImprovementAxes(
      db,
      USER_ID,
      form({ mechanicsAk: "  Rotation trop tardive.\r\n", foulJudgment: "Écrans" }),
    );
    expect(state).toEqual({ status: "saved" });
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0]?.[1]).toEqual([
      USER_ID,
      "Rotation trop tardive.",
      null,
      null,
      null,
      null,
      "Écrans",
      null,
    ]);
  });

  it("accepte une fiche entièrement vide (tout est effacé)", async () => {
    const { db, query } = makeFakeDb();
    expect(await handleSaveImprovementAxes(db, USER_ID, form({}))).toEqual({ status: "saved" });
    expect(query.mock.calls[0]?.[1]).toEqual([USER_ID, null, null, null, null, null, null, null]);
  });

  it("refuse un texte trop long sans rien écrire", async () => {
    const { db, query } = makeFakeDb();
    const state = await handleSaveImprovementAxes(
      db,
      USER_ID,
      form({ decisionMaking: "a".repeat(4097), signals: "ok" }),
    );
    expect(state).toEqual({ status: "invalid", fields: ["decisionMaking"] });
    expect(query).not.toHaveBeenCalled();
  });

  it("refuse un caractère de contrôle", async () => {
    const { db } = makeFakeDb();
    const state = await handleSaveImprovementAxes(db, USER_ID, form({ mechanicsAt: "a\u0000b" }));
    expect(state).toEqual({ status: "invalid", fields: ["mechanicsAt"] });
  });
});

describe("improvementAxesFormValues", () => {
  it("part de champs vides sans fiche enregistrée", () => {
    expect(Object.values(improvementAxesFormValues(null)).every((v) => v === "")).toBe(true);
  });

  it("reprend la fiche enregistrée", () => {
    const values = improvementAxesFormValues({
      mechanicsAk: null,
      mechanicsAt: "Placement en tête",
      mechanicsTransitions: null,
      decisionMaking: null,
      signals: null,
      foulJudgment: null,
      violationJudgment: "Marcher",
    });
    expect(values.mechanicsAt).toBe("Placement en tête");
    expect(values.violationJudgment).toBe("Marcher");
    expect(values.mechanicsAk).toBe("");
  });
});
