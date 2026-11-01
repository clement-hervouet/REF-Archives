import { describe, expect, it, vi } from "vitest";
import { makeFakeDb } from "../db/fake-db";
import type { Queryable } from "../db/users";
import { acceptInvitation, createInvitationForEmail } from "./invitations";
import type { AcceptInvitationDeps, CreateInvitationDeps } from "./invitations";
import { hashToken } from "./tokens";

const NOW = new Date("2026-11-01T10:00:00.000Z");
const EXPIRES_AT = new Date("2026-11-04T10:00:00.000Z");
const ADMIN_ID = "3f0c1d52-9b0a-4c55-8a3e-2f6f3a1c9e11";
const INVITATION_ID = "b2f7a1c4-6d3e-4f08-9a1b-5c7e2d9f0a13";
const NEW_USER_ID = "9d6c2f4e-1b7a-4e0c-9a55-0c2d7f1e8b33";
const EMAIL = "invite@example.com";
const PASSWORD = "correct horse battery staple";
const TOKEN = `${"A".repeat(42)}b`; // 43 caractères base64url, comme un vrai jeton
const IP = "203.0.113.7";

const INVITATION_ROW = { id: INVITATION_ID, email: EMAIL, expires_at: EXPIRES_AT };
const USER_ROW = { id: NEW_USER_ID, email: EMAIL, role: "user" };

describe("createInvitationForEmail", () => {
  const generated = { token: "T".repeat(43), hash: Buffer.alloc(32, 7) };

  function setup() {
    const { db, query } = makeFakeDb();
    const deps = {
      generateToken: () => generated,
      transaction: <T>(action: (tx: Queryable) => Promise<T>) => action(db),
    } satisfies CreateInvitationDeps;
    return { deps, query };
  }

  it("crée l'invitation et renvoie le jeton à afficher à l'admin", async () => {
    const { deps, query } = setup();
    query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [INVITATION_ROW] });
    expect(await createInvitationForEmail(deps, { email: EMAIL, invitedBy: ADMIN_ID })).toEqual({
      status: "created",
      invitationId: INVITATION_ID,
      token: generated.token,
      expiresAt: EXPIRES_AT,
    });
  });

  it("ne stocke que l'empreinte du jeton, jamais le jeton", async () => {
    const { deps, query } = setup();
    query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [INVITATION_ROW] });
    await createInvitationForEmail(deps, { email: EMAIL, invitedBy: ADMIN_ID });
    expect(query.mock.calls[1]?.[1]).toContain(generated.hash);
    expect(JSON.stringify(query.mock.calls)).not.toContain(generated.token);
  });

  it("signale un email qui a déjà un compte", async () => {
    const { deps } = setup();
    expect(await createInvitationForEmail(deps, { email: EMAIL, invitedBy: ADMIN_ID })).toEqual({
      status: "email_taken",
    });
  });

  it("relance les erreurs de la base", async () => {
    const { deps, query } = setup();
    const failure = new Error("connexion perdue");
    query.mockRejectedValue(failure);
    await expect(
      createInvitationForEmail(deps, { email: EMAIL, invitedBy: ADMIN_ID }),
    ).rejects.toBe(failure);
  });
});

describe("acceptInvitation", () => {
  function setup() {
    const { db, query } = makeFakeDb();
    const deps = {
      admitAttempt: vi
        .fn<AcceptInvitationDeps["admitAttempt"]>()
        .mockResolvedValue({ admitted: true }),
      hashPassword: vi.fn<AcceptInvitationDeps["hashPassword"]>().mockResolvedValue("hashed"),
      transaction: <T>(action: (tx: Queryable) => Promise<T>) => action(db),
      now: () => NOW,
    } satisfies AcceptInvitationDeps;
    return { deps, query };
  }

  /** Verrou de l'invitation, marquage « acceptée », création du compte. */
  function scriptSuccess(query: ReturnType<typeof setup>["query"]) {
    query
      .mockResolvedValueOnce({ rows: [INVITATION_ROW] })
      .mockResolvedValueOnce({ rows: [{ id: INVITATION_ID }] })
      .mockResolvedValueOnce({ rows: [USER_ROW] });
  }

  it("crée le compte avec l'email de l'invitation et le rôle utilisateur", async () => {
    const { deps, query } = setup();
    scriptSuccess(query);
    expect(await acceptInvitation(deps, { token: TOKEN, password: PASSWORD, ip: IP })).toEqual({
      status: "created",
      userId: NEW_USER_ID,
      email: EMAIL,
    });
    expect(query.mock.calls[0]?.[1]).toEqual([hashToken(TOKEN)]);
    expect(query.mock.calls[2]?.[1]).toEqual([EMAIL, "hashed", "user"]);
    expect(deps.hashPassword).toHaveBeenCalledWith(PASSWORD);
  });

  it("marque l'invitation acceptée avant de créer le compte", async () => {
    const { deps, query } = setup();
    scriptSuccess(query);
    await acceptInvitation(deps, { token: TOKEN, password: PASSWORD, ip: IP });
    expect(query.mock.calls[0]?.[0]).toContain("FOR UPDATE");
    expect(query.mock.calls[1]?.[0]).toContain("accepted_at = now()");
    expect(query.mock.calls[2]?.[0]).toContain('INSERT INTO "user"');
  });

  it("n'écrit jamais le mot de passe en clair dans une requête", async () => {
    const { deps, query } = setup();
    scriptSuccess(query);
    await acceptInvitation(deps, { token: TOKEN, password: PASSWORD, ip: IP });
    expect(JSON.stringify(query.mock.calls)).not.toContain(PASSWORD);
    expect(JSON.stringify(query.mock.calls)).not.toContain(TOKEN);
  });

  it("compte la tentative par IP et par jeton, sans donnée en clair", async () => {
    const { deps, query } = setup();
    scriptSuccess(query);
    await acceptInvitation(deps, { token: TOKEN, password: PASSWORD, ip: IP });
    const keys = deps.admitAttempt.mock.lastCall?.[0] ?? [];
    expect(keys).toHaveLength(2);
    expect(keys[0]).toMatch(/^invitation:ip:[0-9a-f]{64}$/);
    expect(keys[1]).toMatch(/^invitation:token:[0-9a-f]{64}$/);
    for (const key of keys) {
      expect(key).not.toContain(IP);
      expect(key).not.toContain(TOKEN);
    }
  });

  it("refuse un jeton mal formé sans compter ni toucher à la base", async () => {
    const { deps, query } = setup();
    expect(await acceptInvitation(deps, { token: "court", password: PASSWORD, ip: IP })).toEqual({
      status: "invalid_invitation",
    });
    expect(deps.admitAttempt).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });

  it("refuse un mot de passe trop faible avec les codes d'erreur, sans compter ni hacher", async () => {
    const { deps, query } = setup();
    expect(await acceptInvitation(deps, { token: TOKEN, password: "court", ip: IP })).toEqual({
      status: "invalid_password",
      issues: ["password.too_short"],
    });
    expect(deps.admitAttempt).not.toHaveBeenCalled();
    expect(deps.hashPassword).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });

  it("refuse un mot de passe courant", async () => {
    const { deps } = setup();
    const result = await acceptInvitation(deps, {
      token: TOKEN,
      password: "Password1234",
      ip: IP,
    });
    expect(result).toEqual({ status: "invalid_password", issues: ["password.too_common"] });
  });

  it("s'arrête quand le rate limiting refuse", async () => {
    const { deps, query } = setup();
    deps.admitAttempt.mockResolvedValue({ admitted: false, retryAfterSeconds: 840 });
    expect(await acceptInvitation(deps, { token: TOKEN, password: PASSWORD, ip: IP })).toEqual({
      status: "rate_limited",
      retryAfterSeconds: 840,
    });
    expect(query).not.toHaveBeenCalled();
    expect(deps.hashPassword).not.toHaveBeenCalled();
  });

  it("refuse une invitation inconnue, expirée, utilisée ou révoquée, sans hacher ni créer", async () => {
    const { deps, query } = setup();
    expect(await acceptInvitation(deps, { token: TOKEN, password: PASSWORD, ip: IP })).toEqual({
      status: "invalid_invitation",
    });
    expect(query.mock.calls).toHaveLength(1);
    expect(deps.hashPassword).not.toHaveBeenCalled();
  });

  it("ne crée pas de compte quand le marquage échoue (invitation consommée entre-temps)", async () => {
    const { deps, query } = setup();
    query.mockResolvedValueOnce({ rows: [INVITATION_ROW] }).mockResolvedValueOnce({ rows: [] });
    expect(await acceptInvitation(deps, { token: TOKEN, password: PASSWORD, ip: IP })).toEqual({
      status: "invalid_invitation",
    });
    expect(query.mock.calls).toHaveLength(2);
    expect(deps.hashPassword).not.toHaveBeenCalled();
  });

  it("répond comme pour un lien invalide quand l'email a déjà un compte", async () => {
    const { deps, query } = setup();
    query
      .mockResolvedValueOnce({ rows: [INVITATION_ROW] })
      .mockResolvedValueOnce({ rows: [{ id: INVITATION_ID }] })
      .mockRejectedValueOnce(Object.assign(new Error("duplicate key"), { code: "23505" }));
    expect(await acceptInvitation(deps, { token: TOKEN, password: PASSWORD, ip: IP })).toEqual({
      status: "invalid_invitation",
    });
  });

  it("relance les autres erreurs de la base", async () => {
    const { deps, query } = setup();
    const failure = new Error("connexion perdue");
    query.mockRejectedValue(failure);
    await expect(
      acceptInvitation(deps, { token: TOKEN, password: PASSWORD, ip: IP }),
    ).rejects.toBe(failure);
  });
});