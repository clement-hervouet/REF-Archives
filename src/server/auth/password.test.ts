import { describe, expect, it } from "vitest";
import { hashPassword, verifyAgainstDummyHash, verifyPassword } from "./password";

describe("hashPassword", () => {
  it("produit un hash argon2id avec les paramètres du §6.1", async () => {
    const result = await hashPassword("correct horse battery staple");
    expect(result.startsWith("$argon2id$")).toBe(true);
    expect(result).toContain("m=65536,t=3,p=4");
  });

  it("ne contient pas le mot de passe en clair", async () => {
    const result = await hashPassword("correct horse battery staple");
    expect(result).not.toContain("correct horse");
  });

  it("produit deux hashs différents pour le même mot de passe (sel aléatoire)", async () => {
    const first = await hashPassword("correct horse battery staple");
    const second = await hashPassword("correct horse battery staple");
    expect(first).not.toBe(second);
  });
});

describe("verifyPassword", () => {
  it("accepte le bon mot de passe", async () => {
    const stored = await hashPassword("correct horse battery staple");
    expect(await verifyPassword(stored, "correct horse battery staple")).toBe(true);
  });

  it("refuse un mauvais mot de passe", async () => {
    const stored = await hashPassword("correct horse battery staple");
    expect(await verifyPassword(stored, "correct horse battery stapl")).toBe(false);
  });

  it("refuse une différence de casse", async () => {
    const stored = await hashPassword("correct horse battery staple");
    expect(await verifyPassword(stored, "Correct horse battery staple")).toBe(false);
  });

  it("renvoie false (sans exception) pour un hash malformé", async () => {
    expect(await verifyPassword("pas-un-hash", "correct horse battery staple")).toBe(false);
  });

  it("renvoie false (sans exception) pour un hash vide", async () => {
    expect(await verifyPassword("", "correct horse battery staple")).toBe(false);
  });
});

describe("verifyAgainstDummyHash", () => {
  it("renvoie toujours false", async () => {
    expect(await verifyAgainstDummyHash("correct horse battery staple")).toBe(false);
    expect(await verifyAgainstDummyHash("")).toBe(false);
  });
});