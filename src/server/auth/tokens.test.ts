import { describe, expect, it } from "vitest";
import { TOKEN_BYTES, generateToken, hashToken } from "./tokens";

describe("generateToken", () => {
  it("produit un jeton base64url de 43 caractères", () => {
    const { token } = generateToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("produit une empreinte de 32 octets", () => {
    const { hash } = generateToken();
    expect(hash.length).toBe(TOKEN_BYTES);
  });

  it("l'empreinte correspond au jeton", () => {
    const { token, hash } = generateToken();
    expect(hashToken(token).equals(hash)).toBe(true);
  });

  it("ne produit jamais deux fois le même jeton", () => {
    const tokens = new Set(Array.from({ length: 100 }, () => generateToken().token));
    expect(tokens.size).toBe(100);
  });

  it("ne contient pas le jeton dans son empreinte", () => {
    const { token, hash } = generateToken();
    expect(hash.toString("base64url")).not.toContain(token);
  });
});

describe("hashToken", () => {
  it("est déterministe", () => {
    expect(hashToken("abc").equals(hashToken("abc"))).toBe(true);
  });

  it("change si un seul caractère change", () => {
    expect(hashToken("abc").equals(hashToken("abd"))).toBe(false);
  });

  it("donne le SHA-256 attendu (vecteur de test connu)", () => {
    expect(hashToken("abc").toString("hex")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});