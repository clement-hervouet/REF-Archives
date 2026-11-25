import { describe, expect, it } from "vitest";
import { richTextToPlain } from "./plain-text";

describe("richTextToPlain", () => {
  it("laisse un texte sans mise en forme tel quel", () => {
    expect(richTextToPlain("Le 8 provoque beaucoup.\nMeneur rapide, 3 * 4 = 12.")).toBe(
      "Le 8 provoque beaucoup.\nMeneur rapide, 3 * 4 = 12.",
    );
  });

  it("retire gras, italique, souligné, barré et surligné", () => {
    expect(richTextToPlain("**gras** *italique* <u>souligné</u> ~~barré~~ ==surligné==")).toBe(
      "gras italique souligné barré surligné",
    );
  });

  it("retire les tailles, citations et séparateurs", () => {
    expect(richTextToPlain("# Titre\n\n-# petit\n\n> cité\n\n---")).toBe(
      "Titre\n\npetit\n\ncité\n\n—",
    );
  });

  it("garde les listes lisibles", () => {
    expect(richTextToPlain("- [ ] à faire\n- [x] fait\n- puce\n  - sous-puce\n1. un")).toBe(
      "☐ à faire\n☑ fait\n• puce\n  • sous-puce\n1. un",
    );
  });

  it("rend les caractères échappés et ignore les sauts de ligne forcés", () => {
    expect(richTextToPlain("un \\* seul  \nligne suivante")).toBe("un * seul\nligne suivante");
  });

  it("reste lisible quand l'extrait coupe une balise", () => {
    expect(richTextToPlain("début **gras coup")).toBe("début gras coup");
  });
});
