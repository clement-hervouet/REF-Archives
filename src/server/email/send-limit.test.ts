import { describe, expect, it } from "vitest";
import { emailSendKeys } from "./send-limit";

const USER = "0b8f6c1e-4a52-4a8e-9a43-2f5f2f6f1a11";
const IP = "203.0.113.7";

describe("emailSendKeys", () => {
  it("renvoie une clé par utilisateur et une par IP, dans l'espace de noms email:", () => {
    const keys = emailSendKeys(USER, IP);
    expect(keys).toHaveLength(2);
    expect(keys.every((key) => key.startsWith("email:"))).toBe(true);
  });

  it("ne contient jamais l'identifiant ni l'IP en clair", () => {
    const joined = emailSendKeys(USER, IP).join(" ");
    expect(joined).not.toContain(USER);
    expect(joined).not.toContain(IP);
  });

  it("est déterministe", () => {
    expect(emailSendKeys(USER, IP)).toEqual(emailSendKeys(USER, IP));
  });

  it("sépare les utilisateurs et les IP", () => {
    const base = emailSendKeys(USER, IP);
    const otherUser = emailSendKeys("autre-utilisateur", IP);
    const otherIp = emailSendKeys(USER, "198.51.100.9");
    expect(otherUser[0]).not.toBe(base[0]);
    expect(otherUser[1]).toBe(base[1]);
    expect(otherIp[0]).toBe(base[0]);
    expect(otherIp[1]).not.toBe(base[1]);
  });

  it("n'entre pas en collision avec les clés de connexion", () => {
    expect(emailSendKeys(USER, IP).some((key) => key.startsWith("login:"))).toBe(false);
  });
});
