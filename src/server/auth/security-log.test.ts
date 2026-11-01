import { describe, expect, it, vi } from "vitest";
import { UNKNOWN_IP } from "./client-ip";
import { createSecurityEventRecorder, hashIpForLog } from "./security-log";
import type { SecurityLogDeps } from "./security-log";

const USER_ID = "3f0c1d52-9b0a-4c55-8a3e-2f6f3a1c9e11";
const SECRET = "s".repeat(32);
const IP = "203.0.113.7";

function setup() {
  const deps = {
    insert: vi.fn<SecurityLogDeps["insert"]>().mockResolvedValue(undefined),
    secret: () => SECRET,
    onError: vi.fn<SecurityLogDeps["onError"]>(),
  } satisfies SecurityLogDeps;
  return { deps, record: createSecurityEventRecorder(deps) };
}

describe("hashIpForLog", () => {
  it("produit un HMAC-SHA256 hexadécimal de 64 caractères", () => {
    expect(hashIpForLog(IP, SECRET)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("est déterministe", () => {
    expect(hashIpForLog(IP, SECRET)).toBe(hashIpForLog(IP, SECRET));
  });

  it("change avec l'IP et avec le secret", () => {
    expect(hashIpForLog("203.0.113.8", SECRET)).not.toBe(hashIpForLog(IP, SECRET));
    expect(hashIpForLog(IP, "t".repeat(32))).not.toBe(hashIpForLog(IP, SECRET));
  });

  it("ne contient pas l'IP en clair", () => {
    expect(hashIpForLog(IP, SECRET)).not.toContain(IP);
  });

  it("donne le HMAC attendu (vecteur de test RFC 4231, cas 2)", () => {
    expect(hashIpForLog("what do ya want for nothing?", "Jefe")).toBe(
      "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843",
    );
  });
});

describe("createSecurityEventRecorder", () => {
  it("enregistre le type, l'utilisateur et l'empreinte de l'IP", async () => {
    const { deps, record } = setup();
    await record({ type: "login_succeeded", userId: USER_ID, ip: IP });
    expect(deps.insert).toHaveBeenCalledWith({
      type: "login_succeeded",
      userId: USER_ID,
      ipHash: hashIpForLog(IP, SECRET),
    });
  });

  it("n'envoie jamais l'IP en clair à la base", async () => {
    const { deps, record } = setup();
    await record({ type: "login_failed", ip: IP });
    expect(JSON.stringify(deps.insert.mock.calls)).not.toContain(IP);
  });

  it("enregistre un utilisateur inconnu comme null", async () => {
    const { deps, record } = setup();
    await record({ type: "login_failed", ip: IP });
    expect(deps.insert.mock.lastCall?.[0].userId).toBeNull();
  });

  it("ne stocke aucune empreinte quand l'IP est absente ou inconnue", async () => {
    const { deps, record } = setup();
    await record({ type: "logout", userId: USER_ID });
    await record({ type: "logout", userId: USER_ID, ip: UNKNOWN_IP });
    expect(deps.insert.mock.calls[0]?.[0].ipHash).toBeNull();
    expect(deps.insert.mock.calls[1]?.[0].ipHash).toBeNull();
  });

  it("ne lève jamais d'erreur quand l'écriture échoue", async () => {
    const { deps, record } = setup();
    deps.insert.mockRejectedValue(new Error("connexion perdue"));
    await expect(record({ type: "login_succeeded", userId: USER_ID, ip: IP })).resolves.toBeUndefined();
  });

  it("signale seulement le nom de l'erreur, jamais son message", async () => {
    const { deps, record } = setup();
    const failure = new TypeError(`Key (email)=(clem@example.com) already exists`);
    deps.insert.mockRejectedValue(failure);
    await record({ type: "login_succeeded", userId: USER_ID, ip: IP });
    expect(deps.onError).toHaveBeenCalledWith("TypeError");
    expect(JSON.stringify(deps.onError.mock.calls)).not.toContain("clem@example.com");
  });

  it("signale aussi une erreur qui n'est pas une instance d'Error", async () => {
    const { deps, record } = setup();
    deps.insert.mockRejectedValue("échec");
    await record({ type: "logout", userId: USER_ID });
    expect(deps.onError).toHaveBeenCalledWith("UnknownError");
  });
});