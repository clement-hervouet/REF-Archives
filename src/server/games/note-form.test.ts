import { describe, expect, it } from "vitest";
import { makeFakeDb } from "../db/fake-db";
import type { Queryable } from "../db/users";
import { handleDeleteNote, handleSaveNote, noteFormValues, readNoteFormData } from "./note-form";
import type { GameDeps } from "./rejection";

const USER_ID = "3f0c1d52-9b0a-4c55-8a3e-2f6f3a1c9e11";
const GAME_ID = "6f7a8b9c-0d1e-4f2a-8b3c-4d5e6f7a8b01";
const NOTE_ID = "7a8b9c0d-1e2f-4a3b-8c4d-5e6f7a8b9c01";

function formData(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(entries)) {
    data.set(name, value);
  }
  return data;
}

function setup() {
  const { db, query } = makeFakeDb();
  const deps = {
    transaction: <T>(action: (tx: Queryable) => Promise<T>) => action(db),
  } satisfies GameDeps;
  return { deps, query };
}

describe("readNoteFormData", () => {
  it("découpe les liens par ligne et traite un niveau absent comme non renseigné", () => {
    expect(
      readNoteFormData(formData({ body: "RAS", clips: "https://a.fr\r\n\nhttps://b.fr" })),
    ).toEqual({
      confidence: "",
      stress: "",
      management: "",
      judgment: "",
      body: "RAS",
      clips: ["https://a.fr", "", "https://b.fr"],
    });
  });
});

describe("handleSaveNote", () => {
  it("enregistre une note valide", async () => {
    const { deps, query } = setup();
    query
      .mockResolvedValueOnce({ rows: [{ id: GAME_ID }] })
      .mockResolvedValueOnce({ rows: [{ id: NOTE_ID }] });
    expect(
      await handleSaveNote(deps, USER_ID, formData({ gameId: GAME_ID, confidence: "3" })),
    ).toEqual({ status: "saved" });
  });

  it("signale les lignes de liens refusées (numérotées à partir de 1) et la note vide", async () => {
    const { deps, query } = setup();
    expect(
      await handleSaveNote(
        deps,
        USER_ID,
        formData({ gameId: GAME_ID, stress: "9", clips: "https://ok.fr\njavascript:alert(1)" }),
      ),
    ).toEqual({
      status: "invalid",
      fields: ["stress"],
      clipLines: [2],
      tooManyClips: false,
      empty: false,
    });
    expect(
      await handleSaveNote(deps, USER_ID, formData({ gameId: GAME_ID, body: "  ", clips: "" })),
    ).toEqual({ status: "invalid", fields: [], clipLines: [], tooManyClips: false, empty: true });
    expect(query).not.toHaveBeenCalled();
  });

  it("signale un match introuvable ou un identifiant mal formé", async () => {
    const { deps } = setup();
    expect(await handleSaveNote(deps, USER_ID, formData({ gameId: GAME_ID, body: "x" }))).toEqual({
      status: "not_found",
      field: "game",
    });
    expect(await handleSaveNote(deps, USER_ID, formData({ gameId: "x", body: "x" }))).toEqual({
      status: "not_found",
      field: "game",
    });
  });
});

describe("handleDeleteNote", () => {
  it("supprime la note du match", async () => {
    const { deps, query } = setup();
    query.mockResolvedValueOnce({ rows: [{ id: NOTE_ID }] });
    expect(await handleDeleteNote(deps, USER_ID, formData({ gameId: GAME_ID }))).toEqual({
      status: "deleted",
    });
    expect(query.mock.calls[0]?.[1]).toEqual([GAME_ID, USER_ID]);
  });

  it("signale l'absence de note", async () => {
    const { deps } = setup();
    expect(await handleDeleteNote(deps, USER_ID, formData({ gameId: GAME_ID }))).toEqual({
      status: "not_found",
    });
  });
});

describe("noteFormValues", () => {
  it("prépare les champs depuis la note enregistrée", () => {
    expect(
      noteFormValues({
        confidence: 4,
        stress: null,
        management: null,
        judgment: 3,
        body: null,
        clips: ["https://a.fr/"],
      }),
    ).toEqual({
      confidence: "4",
      stress: "",
      management: "",
      judgment: "3",
      body: "",
      clips: "https://a.fr/",
    });
    expect(noteFormValues(null)).toEqual({
      confidence: "",
      stress: "",
      management: "",
      judgment: "",
      body: "",
      clips: "",
    });
  });
});
