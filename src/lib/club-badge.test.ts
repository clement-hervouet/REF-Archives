import { describe, expect, it } from "vitest";
import { clubInitials, initialsTone, relativeLuminance } from "./club-badge";

describe("clubInitials", () => {
  it("prend la première lettre des deux premiers mots", () => {
    expect(clubInitials("BC BÉTHUNE")).toBe("BB");
    expect(clubInitials("US AMBERT BASKET")).toBe("UA");
  });

  it("ignore les petits mots et compte un mot composé pour un", () => {
    expect(clubInitials("UNION DE LA VALLÉE")).toBe("UV");
    expect(clubInitials("SAINT-FLOUR BASKET")).toBe("SB");
    expect(clubInitials("L'ÉTOILE D'ARRAS")).toBe("ÉA");
  });

  it("prend deux lettres d'un nom d'un seul mot, et met en majuscules", () => {
    expect(clubInitials("ASPTT")).toBe("AS");
    expect(clubInitials("rennes")).toBe("RE");
  });

  it("rend « ? » sans lettre", () => {
    expect(clubInitials("  ")).toBe("?");
  });
});

describe("initialsTone", () => {
  it("choisit le texte qui contraste le plus", () => {
    expect(initialsTone("#263a5d")).toBe("light");
    expect(initialsTone("#bfc3ea")).toBe("dark");
    expect(initialsTone("#ffffff")).toBe("dark");
    expect(initialsTone("#000000")).toBe("light");
  });

  it("rend null sans couleur exploitable", () => {
    expect(initialsTone(null)).toBeNull();
    expect(initialsTone("rouge")).toBeNull();
    expect(relativeLuminance("#12345")).toBeNull();
  });
});
