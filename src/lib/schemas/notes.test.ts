import { describe, expect, it } from "vitest";
import {
  MAX_CLIPS_PER_NOTE,
  noteBodySchema,
  noteClipsSchema,
  noteFormSchema,
  noteLevelSchema,
  normalizeClipUrl,
  type NoteFormInput,
} from "./notes";

function input(overrides: Partial<NoteFormInput> = {}): NoteFormInput {
  return { confidence: "", stress: "", body: "", clips: [], ...overrides };
}

/** Erreurs du formulaire sous la forme « chemin:code ». */
function formIssues(overrides: Partial<NoteFormInput>): string[] {
  const result = noteFormSchema.safeParse(input(overrides));
  if (result.success) {
    return [];
  }
  return result.error.issues.map((issue) => `${issue.path.join(".")}:${issue.message}`);
}

describe("normalizeClipUrl", () => {
  it("accepte http et https et normalise l'URL", () => {
    expect(normalizeClipUrl("https://www.youtube.com/watch?v=abc123")).toBe(
      "https://www.youtube.com/watch?v=abc123",
    );
    expect(normalizeClipUrl("  HTTPS://Drive.Google.com/file/d/xyz  ")).toBe(
      "https://drive.google.com/file/d/xyz",
    );
    expect(normalizeClipUrl("http://example.com")).toBe("http://example.com/");
    expect(normalizeClipUrl("https://example.com/mon clip")).toBe("https://example.com/mon%20clip");
  });

  it("refuse les schémas dangereux ou non web", () => {
    for (const value of [
      "javascript:alert(1)",
      "JavaScript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "file:///etc/passwd",
      "ftp://example.com/clip.mp4",
      "vbscript:msgbox(1)",
      "mailto:a@b.fr",
    ]) {
      expect(normalizeClipUrl(value)).toBeNull();
    }
  });

  it("refuse les identifiants dans l'URL (hôte trompeur)", () => {
    expect(normalizeClipUrl("https://youtube.com@piege.example/clip")).toBeNull();
    expect(normalizeClipUrl("https://user:secret@example.com/clip")).toBeNull();
  });

  it("refuse une saisie vide, non analysable ou trop longue", () => {
    expect(normalizeClipUrl("")).toBeNull();
    expect(normalizeClipUrl("   ")).toBeNull();
    expect(normalizeClipUrl("youtube.com/watch?v=abc")).toBeNull();
    expect(normalizeClipUrl("https://")).toBeNull();
    expect(normalizeClipUrl(`https://example.com/${"a".repeat(2048)}`)).toBeNull();
  });
});

describe("noteLevelSchema", () => {
  it("convertit 1 à 5 et rend le niveau facultatif", () => {
    expect(noteLevelSchema.parse("1")).toBe(1);
    expect(noteLevelSchema.parse(" 5 ")).toBe(5);
    expect(noteLevelSchema.parse("")).toBeNull();
  });

  it("refuse les valeurs hors échelle", () => {
    for (const value of ["0", "6", "10", "-1", "2.5", "a", "01"]) {
      expect(noteLevelSchema.safeParse(value).success).toBe(false);
    }
  });
});

describe("noteBodySchema", () => {
  it("garde les sauts de ligne, normalise les fins de ligne et rogne", () => {
    expect(noteBodySchema.parse("  Bon placement.\r\nÀ revoir : 3e QT\t(faute)  ")).toBe(
      "Bon placement.\nÀ revoir : 3e QT\t(faute)",
    );
  });

  it("transforme une saisie vide en null", () => {
    expect(noteBodySchema.parse("")).toBeNull();
    expect(noteBodySchema.parse(" \n\t ")).toBeNull();
  });

  it("accepte 4 096 caractères et refuse au-delà", () => {
    expect(noteBodySchema.safeParse("x".repeat(4096)).success).toBe(true);
    expect(noteBodySchema.safeParse("x".repeat(4097)).success).toBe(false);
  });

  it("refuse les autres caractères de contrôle", () => {
    expect(noteBodySchema.safeParse("texte\u0000caché").success).toBe(false);
    expect(noteBodySchema.safeParse("texte\u001bcaché").success).toBe(false);
  });
});

describe("noteClipsSchema", () => {
  it("ignore les lignes vides, retire les doublons et garde l'ordre", () => {
    expect(
      noteClipsSchema.parse([
        "https://example.com/b",
        "",
        "  ",
        "https://example.com/a",
        "HTTPS://example.com/b",
      ]),
    ).toEqual(["https://example.com/b", "https://example.com/a"]);
  });

  it("signale chaque lien invalide à son index", () => {
    const result = noteClipsSchema.safeParse([
      "https://example.com/ok",
      "javascript:alert(1)",
      "pas un lien",
    ]);
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => `${issue.path.join(".")}:${issue.message}`)).toEqual(
      ["1:clip_invalid", "2:clip_invalid"],
    );
  });

  it(`accepte ${String(MAX_CLIPS_PER_NOTE)} liens et refuse au-delà`, () => {
    const links = (count: number) =>
      Array.from({ length: count }, (_, index) => `https://example.com/${String(index)}`);
    expect(noteClipsSchema.safeParse(links(MAX_CLIPS_PER_NOTE)).success).toBe(true);
    expect(noteClipsSchema.safeParse(links(MAX_CLIPS_PER_NOTE + 1)).success).toBe(false);
  });
});

describe("noteFormSchema", () => {
  it("accepte une note avec un seul champ renseigné", () => {
    expect(formIssues({ confidence: "4" })).toEqual([]);
    expect(formIssues({ stress: "2" })).toEqual([]);
    expect(formIssues({ body: "RAS" })).toEqual([]);
    expect(formIssues({ clips: ["https://example.com/clip"] })).toEqual([]);
  });

  it("renvoie la note nettoyée", () => {
    expect(
      noteFormSchema.parse(
        input({ confidence: "4", stress: "", body: " RAS ", clips: ["", "https://ex.fr/c"] }),
      ),
    ).toEqual({ confidence: 4, stress: null, body: "RAS", clips: ["https://ex.fr/c"] });
  });

  it("refuse une note vide", () => {
    expect(formIssues({})).toEqual(["body:empty_note"]);
    expect(formIssues({ body: "   ", clips: ["", " "] })).toEqual(["body:empty_note"]);
  });

  it("signale un lien invalide avec son chemin complet", () => {
    expect(formIssues({ body: "RAS", clips: ["data:text/html,x"] })).toEqual([
      "clips.0:clip_invalid",
    ]);
  });
});
