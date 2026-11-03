import { describe, expect, it } from "vitest";
import type { Queryable } from "../db/users";
import { requestPasswordReset, resetPassword } from "./password-reset";
import type { RequestPasswordResetDeps, ResetPasswordDeps } from "./password-reset";

const USER_ID = "3f2b8c1e-5d4a-4f6b-9a7c-1e2d3c4b5a69";
const RESET_ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
const TOKEN = "A".repeat(43);
const PASSWORD = "k7#Vq2-mZp9!xR4wLb";
const NOW = new Date("2026-11-03T10:00:00Z");
const EXPIRES = new Date("2026-11-03T10:30:00Z");
const IP = "203.0.113.7";
const EMAIL = "arbitre@example.com";

type Call = { sql: string; values: unknown[] };
type Scenario = Partial<Record<string, Record<string, unknown>[]>>;

/** Reconnaît une requête à son début de texte (les constantes SQL sont dans `src/server/db/`). */
function kind(sql: string): string {
  if (sql.includes("FOR UPDATE")) return "lock_reset";
  if (sql.startsWith("INSERT INTO password_reset")) return "insert_reset";
  if (sql.startsWith("DELETE FROM password_reset")) return "delete_resets";
  if (sql.startsWith("UPDATE password_reset")) return "mark_used";
  if (sql.startsWith('UPDATE "user"')) return "update_password";
  if (sql.startsWith("UPDATE session")) return "revoke_sessions";
  if (sql.includes('FROM "user"')) return "find_user";
  return "other";
}

function setup(rows: Scenario): {
  calls: Call[];
  transaction: ResetPasswordDeps["transaction"];
} {
  const calls: Call[] = [];
  const db: Queryable = {
    query: (sql, values) => {
      calls.push({ sql, values });
      return Promise.resolve({ rows: rows[kind(sql)] ?? [] });
    },
  };
  return { calls, transaction: (action) => action(db) };
}

function kinds(calls: Call[]): string[] {
  return calls.map((call) => kind(call.sql));
}

function admitting(keysSeen: string[][]): RequestPasswordResetDeps["admitAttempt"] {
  return (keys) => {
    keysSeen.push(keys);
    return Promise.resolve({ admitted: true });
  };
}

describe("requestPasswordReset", () => {
  function build(rows: Scenario, admitAttempt?: RequestPasswordResetDeps["admitAttempt"]) {
    const { calls, transaction } = setup(rows);
    const keysSeen: string[][] = [];
    let tokensGenerated = 0;
    const deps: RequestPasswordResetDeps = {
      admitAttempt: admitAttempt ?? admitting(keysSeen),
      generateToken: () => {
        tokensGenerated += 1;
        return { token: TOKEN, hash: Buffer.alloc(32, 1) };
      },
      transaction,
      now: () => NOW,
    };
    return { deps, calls, keysSeen, tokensGenerated: () => tokensGenerated };
  }

  it("refuse sans toucher à la base quand la limite est atteinte", async () => {
    const { deps, calls, tokensGenerated } = build({}, () =>
      Promise.resolve({ admitted: false, retryAfterSeconds: 120 }),
    );
    const result = await requestPasswordReset(deps, { email: EMAIL, ip: IP });
    expect(result).toEqual({ status: "rate_limited", retryAfterSeconds: 120 });
    expect(calls).toHaveLength(0);
    expect(tokensGenerated()).toBe(0);
  });

  it("compte la tentative avec des clés hachées (ni IP ni email en clair)", async () => {
    const { deps, keysSeen } = build({});
    await requestPasswordReset(deps, { email: EMAIL, ip: IP });
    const keys = keysSeen[0] ?? [];
    expect(keys).toHaveLength(2);
    expect(keys.every((key) => key.startsWith("reset-request:"))).toBe(true);
    expect(keys.join(" ")).not.toContain(IP);
    expect(keys.join(" ")).not.toContain(EMAIL);
  });

  it("ne crée rien et ne génère aucun jeton si le compte n'existe pas", async () => {
    const { deps, calls, tokensGenerated } = build({});
    const result = await requestPasswordReset(deps, { email: EMAIL, ip: IP });
    expect(result).toEqual({ status: "no_account" });
    expect(kinds(calls)).toEqual(["find_user"]);
    expect(tokensGenerated()).toBe(0);
  });

  it("supprime les anciens jetons avant d'en insérer un nouveau", async () => {
    const { deps, calls } = build({
      find_user: [{ id: USER_ID }],
      insert_reset: [{ id: RESET_ID, expires_at: EXPIRES }],
    });
    const result = await requestPasswordReset(deps, { email: EMAIL, ip: IP });
    expect(result).toEqual({
      status: "issued",
      userId: USER_ID,
      email: EMAIL,
      token: TOKEN,
      expiresAt: EXPIRES,
    });
    expect(kinds(calls)).toEqual(["find_user", "delete_resets", "insert_reset"]);
  });

  it("ne stocke que l'empreinte du jeton, jamais le jeton", async () => {
    const { deps, calls } = build({
      find_user: [{ id: USER_ID }],
      insert_reset: [{ id: RESET_ID, expires_at: EXPIRES }],
    });
    await requestPasswordReset(deps, { email: EMAIL, ip: IP });
    const insert = calls.find((call) => kind(call.sql) === "insert_reset");
    expect(insert?.values).toContainEqual(Buffer.alloc(32, 1));
    expect(insert?.values).not.toContain(TOKEN);
  });
});

describe("resetPassword", () => {
  function build(rows: Scenario, admitAttempt?: ResetPasswordDeps["admitAttempt"]) {
    const { calls, transaction } = setup(rows);
    const keysSeen: string[][] = [];
    const deps: ResetPasswordDeps = {
      admitAttempt: admitAttempt ?? admitting(keysSeen),
      hashPassword: (password) => Promise.resolve(`hashed:${password}`),
      transaction,
      now: () => NOW,
    };
    return { deps, calls, keysSeen };
  }

  const success: Scenario = {
    lock_reset: [{ id: RESET_ID, user_id: USER_ID, expires_at: EXPIRES }],
    mark_used: [{ id: RESET_ID }],
    update_password: [{ email: EMAIL }],
  };

  it("refuse un jeton mal formé avant tout accès à la base", async () => {
    const { deps, calls, keysSeen } = build(success);
    const result = await resetPassword(deps, { token: "trop-court", password: PASSWORD, ip: IP });
    expect(result).toEqual({ status: "invalid_link" });
    expect(calls).toHaveLength(0);
    expect(keysSeen).toHaveLength(0);
  });

  it("refuse un mot de passe invalide sans compter de tentative", async () => {
    const { deps, calls, keysSeen } = build(success);
    const result = await resetPassword(deps, { token: TOKEN, password: "court", ip: IP });
    expect(result.status).toBe("invalid_password");
    if (result.status === "invalid_password") {
      expect(result.issues).toContain("password.too_short");
    }
    expect(calls).toHaveLength(0);
    expect(keysSeen).toHaveLength(0);
  });

  it("refuse sans toucher à la base quand la limite est atteinte", async () => {
    const { deps, calls } = build(success, () =>
      Promise.resolve({ admitted: false, retryAfterSeconds: 300 }),
    );
    const result = await resetPassword(deps, { token: TOKEN, password: PASSWORD, ip: IP });
    expect(result).toEqual({ status: "rate_limited", retryAfterSeconds: 300 });
    expect(calls).toHaveLength(0);
  });

  it("compte la tentative avec des clés hachées (ni IP ni jeton en clair)", async () => {
    const { deps, keysSeen } = build(success);
    await resetPassword(deps, { token: TOKEN, password: PASSWORD, ip: IP });
    const keys = keysSeen[0] ?? [];
    expect(keys.some((key) => key.startsWith("reset:ip:"))).toBe(true);
    expect(keys.some((key) => key.startsWith("reset:token:"))).toBe(true);
    expect(keys.join(" ")).not.toContain(IP);
    expect(keys.join(" ")).not.toContain(TOKEN);
  });

  it("renvoie invalid_link si le lien est inconnu, expiré ou déjà utilisé", async () => {
    const { deps, calls } = build({});
    const result = await resetPassword(deps, { token: TOKEN, password: PASSWORD, ip: IP });
    expect(result).toEqual({ status: "invalid_link" });
    expect(kinds(calls)).toEqual(["lock_reset"]);
  });

  it("ne change pas le mot de passe si le jeton a été consommé entre-temps", async () => {
    const { deps, calls } = build({ lock_reset: success.lock_reset ?? [] });
    const result = await resetPassword(deps, { token: TOKEN, password: PASSWORD, ip: IP });
    expect(result).toEqual({ status: "invalid_link" });
    expect(kinds(calls)).toEqual(["lock_reset", "mark_used"]);
  });

  it("change le mot de passe, purge les autres jetons et révoque toutes les sessions", async () => {
    const { deps, calls } = build(success);
    const result = await resetPassword(deps, { token: TOKEN, password: PASSWORD, ip: IP });
    expect(result).toEqual({ status: "reset", userId: USER_ID, email: EMAIL });
    expect(kinds(calls)).toEqual([
      "lock_reset",
      "mark_used",
      "update_password",
      "delete_resets",
      "revoke_sessions",
    ]);
  });

  it("renvoie invalid_link si le compte n'existe plus au moment du changement", async () => {
    const { deps, calls } = build({
      lock_reset: success.lock_reset ?? [],
      mark_used: success.mark_used ?? [],
    });
    const result = await resetPassword(deps, { token: TOKEN, password: PASSWORD, ip: IP });
    expect(result).toEqual({ status: "invalid_link" });
    expect(kinds(calls)).toEqual(["lock_reset", "mark_used", "update_password"]);
  });

  it("n'écrit en base que le hash, jamais le mot de passe en clair", async () => {
    const { deps, calls } = build(success);
    await resetPassword(deps, { token: TOKEN, password: PASSWORD, ip: IP });
    const update = calls.find((call) => kind(call.sql) === "update_password");
    expect(update?.values).toEqual([USER_ID, `hashed:${PASSWORD}`]);
    expect(calls.some((call) => call.values.includes(PASSWORD))).toBe(false);
  });

  it("révoque toutes les sessions, sans en épargner aucune", async () => {
    const { deps, calls } = build(success);
    await resetPassword(deps, { token: TOKEN, password: PASSWORD, ip: IP });
    const revoke = calls.find((call) => kind(call.sql) === "revoke_sessions");
    expect(revoke?.values).toEqual([USER_ID, null]);
  });
});