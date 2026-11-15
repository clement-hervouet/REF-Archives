import { describe, expect, it, vi } from "vitest";
import { makeFakeDb } from "../db/fake-db";
import type { Queryable } from "../db/users";
import { inviteFromAccessRequest, submitAccessRequest } from "./access-requests";
import type { InviteFromAccessRequestDeps, SubmitAccessRequestDeps } from "./access-requests";
import { hashIdentifier } from "./rate-limit";

const NOW = new Date("2026-11-15T10:00:00.000Z");
const EXPIRES_AT = new Date("2026-11-18T10:00:00.000Z");
const REQUEST_ID = "6a1f0c3e-2b4d-4e5f-8a9b-0c1d2e3f4a5b";
const ADMIN_ID = "3f0c1d52-9b0a-4c55-8a3e-2f6f3a1c9e11";
const INVITATION_ID = "b2f7a1c4-6d3e-4f08-9a1b-5c7e2d9f0a13";
const EMAIL = "demande@example.com";
const IP = "203.0.113.7";
const INPUT = { email: " Demande@Example.com ", firstname: " Léa ", lastname: "Martin", ip: IP };

describe("submitAccessRequest", () => {
  function setup(inserted = true) {
    const deps = {
      admitAttempt: vi
        .fn<SubmitAccessRequestDeps["admitAttempt"]>()
        .mockResolvedValue({ admitted: true }),
      insert: vi.fn<SubmitAccessRequestDeps["insert"]>().mockResolvedValue(inserted),
      now: () => NOW,
    } satisfies SubmitAccessRequestDeps;
    return deps;
  }

  it("enregistre la demande avec l'email normalisé et le nom nettoyé", async () => {
    const deps = setup();
    expect(await submitAccessRequest(deps, INPUT)).toEqual({
      status: "requested",
      email: EMAIL,
      created: true,
    });
    expect(deps.insert).toHaveBeenCalledWith({
      email: EMAIL,
      firstname: "Léa",
      lastname: "Martin",
    });
  });

  it("répond pareil quand la demande est ignorée (compte existant, demande en attente)", async () => {
    const deps = setup(false);
    const result = await submitAccessRequest(deps, INPUT);
    expect(result).toEqual({ status: "requested", email: EMAIL, created: false });
  });

  it("compte la tentative par IP et par adresse, avec des clés hachées", async () => {
    const deps = setup();
    await submitAccessRequest(deps, INPUT);
    expect(deps.admitAttempt).toHaveBeenCalledWith(
      [
        `access-request:ip:${hashIdentifier(IP)}`,
        `access-request:account:${hashIdentifier(EMAIL)}`,
      ],
      NOW,
    );
    const keys = JSON.stringify(deps.admitAttempt.mock.calls);
    expect(keys).not.toContain(IP);
    expect(keys).not.toContain(EMAIL);
  });

  it("refuse une adresse et un nom invalides avant le rate limiting et la base", async () => {
    const deps = setup();
    expect(
      await submitAccessRequest(deps, {
        email: "pas-un-email",
        firstname: "",
        lastname: "",
        ip: IP,
      }),
    ).toEqual({
      status: "invalid",
      emailInvalid: true,
      profileIssues: ["firstname.required", "lastname.required"],
    });
    expect(deps.admitAttempt).not.toHaveBeenCalled();
    expect(deps.insert).not.toHaveBeenCalled();
  });

  it("signale seulement le nom quand l'adresse est valide", async () => {
    const deps = setup();
    expect(await submitAccessRequest(deps, { ...INPUT, lastname: "  " })).toEqual({
      status: "invalid",
      emailInvalid: false,
      profileIssues: ["lastname.required"],
    });
  });

  it("refuse des champs absents (null venant d'un formulaire trafiqué)", async () => {
    const deps = setup();
    const result = await submitAccessRequest(deps, {
      email: null,
      firstname: null,
      lastname: null,
      ip: IP,
    });
    expect(result.status).toBe("invalid");
    expect(deps.insert).not.toHaveBeenCalled();
  });

  it("n'enregistre rien quand le rate limiting refuse", async () => {
    const deps = setup();
    deps.admitAttempt.mockResolvedValue({ admitted: false, retryAfterSeconds: 900 });
    expect(await submitAccessRequest(deps, INPUT)).toEqual({
      status: "rate_limited",
      retryAfterSeconds: 900,
    });
    expect(deps.insert).not.toHaveBeenCalled();
  });
});

describe("inviteFromAccessRequest", () => {
  const generated = { token: "T".repeat(43), hash: Buffer.alloc(32, 7) };

  function setup() {
    const { db, query } = makeFakeDb();
    let transactions = 0;
    const deps = {
      generateToken: () => generated,
      transaction: <T>(action: (tx: Queryable) => Promise<T>) => {
        transactions += 1;
        return action(db);
      },
    } satisfies InviteFromAccessRequestDeps;
    return { deps, query, transactions: () => transactions };
  }

  const INPUT_ADMIN = { requestId: REQUEST_ID, adminId: ADMIN_ID };

  /** Verrou de la demande, révocation des invitations de l'email, insertion, décision. */
  function mockHappyPath(query: ReturnType<typeof setup>["query"]) {
    query
      .mockResolvedValueOnce({ rows: [{ id: REQUEST_ID, email: EMAIL }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ id: INVITATION_ID, email: EMAIL, expires_at: EXPIRES_AT }],
      })
      .mockResolvedValueOnce({ rows: [{ id: REQUEST_ID }] });
  }

  it("crée l'invitation pour l'email de la demande et clôt la demande « invitée »", async () => {
    const { deps, query, transactions } = setup();
    mockHappyPath(query);
    expect(await inviteFromAccessRequest(deps, INPUT_ADMIN)).toEqual({
      status: "created",
      email: EMAIL,
      token: generated.token,
      expiresAt: EXPIRES_AT,
    });
    expect(transactions()).toBe(1);
    expect(query.mock.calls[0]?.[0]).toContain("FOR UPDATE");
    expect(query.mock.calls[2]?.[1]).toEqual([EMAIL, generated.hash, ADMIN_ID, 259_200]);
    expect(query.mock.calls[3]?.[1]).toEqual([REQUEST_ID, ADMIN_ID, "invited"]);
  });

  it("ne stocke que l'empreinte du jeton, jamais le jeton", async () => {
    const { deps, query } = setup();
    mockHappyPath(query);
    await inviteFromAccessRequest(deps, INPUT_ADMIN);
    expect(JSON.stringify(query.mock.calls)).not.toContain(generated.token);
  });

  it("ne fait rien pour une demande inconnue ou déjà traitée", async () => {
    const { deps, query } = setup();
    expect(await inviteFromAccessRequest(deps, INPUT_ADMIN)).toEqual({ status: "not_found" });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("clôt la demande « refusée » si un compte existe déjà pour cet email", async () => {
    const { deps, query } = setup();
    query
      .mockResolvedValueOnce({ rows: [{ id: REQUEST_ID, email: EMAIL }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: REQUEST_ID }] });
    expect(await inviteFromAccessRequest(deps, INPUT_ADMIN)).toEqual({
      status: "email_taken",
      email: EMAIL,
    });
    expect(query.mock.calls[3]?.[1]).toEqual([REQUEST_ID, ADMIN_ID, "refused"]);
  });

  it("relance les erreurs de la base (la transaction est annulée)", async () => {
    const { deps, query } = setup();
    const failure = new Error("connexion perdue");
    query.mockRejectedValue(failure);
    await expect(inviteFromAccessRequest(deps, INPUT_ADMIN)).rejects.toBe(failure);
  });
});
