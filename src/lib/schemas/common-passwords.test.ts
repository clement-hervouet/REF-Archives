import { describe, expect, it } from "vitest";
import { isTrivialPassword } from "./common-passwords";

describe("isTrivialPassword", () => {
  it("refuse un mot de passe de la liste", () => {
    expect(isTrivialPassword("password1234")).toBe(true);
  });

  it("ignore la casse", () => {
    expect(isTrivialPassword("PassWord1234")).toBe(true);
  });

  it("refuse un seul caractère répété", () => {
    expect(isTrivialPassword("aaaaaaaaaaaa")).toBe(true);
  });

  it("refuse un motif court répété", () => {
    expect(isTrivialPassword("abababababab")).toBe(true);
    expect(isTrivialPassword("azertyazerty")).toBe(true);
    expect(isTrivialPassword("Abc123Abc123Abc123")).toBe(true);
  });

  it("accepte une phrase de passe", () => {
    expect(isTrivialPassword("correct horse battery staple")).toBe(false);
  });

  it("accepte un mot de passe mêlant lettres, chiffres et symboles", () => {
    expect(isTrivialPassword("Tr0ub4dor&3-xyz")).toBe(false);
  });

  it("accepte un mot de passe qui contient un mot courant sans l'être", () => {
    expect(isTrivialPassword("password1234-et-un-peu-plus")).toBe(false);
  });

  it("accepte la chaîne vide côté trivialité (la longueur est vérifiée ailleurs)", () => {
    expect(isTrivialPassword("")).toBe(false);
  });
});