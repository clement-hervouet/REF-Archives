import { describe, expect, it } from "vitest";
import { makeFakeDb } from "./fake-db";
import {
  INVITATION_LIST_LIMIT,
  INVITATION_TTL_SECONDS,
  createInvitation,
  findPendingInvitation,
  getInvitationStatus,
  listInvitations,
  lockPendingInvitation,
  markInvitationAccepted,
  revokeInvitation,
} from "./invitations";

const HOUR = 60 * 60 * 1000;
const NOW = new Date("2026-11-01T10:00:00.000Z");
const INVITATION_ID = "b2f7a1c4-6d3e-4f08-9a1b-5c7e2d9f0a13";
const ADMIN_ID = "3f0c1d52-9b0a-4c55-8a3e-2f6f3a1c9e11";
const TOKEN_HASH = Buffer.alloc(32, 7);
const EMAIL = "invite@example.com";
const EXPIRES_AT = new Date(NOW.getTime() + 72 * HOUR);

describe("getInvitationStatus", () => {
  const base = { acceptedAt: null, revokedAt: null, expiresAt: EXPIRES_AT };

  it("est en attente tant que la date d'expiration n'est pas atteinte", () => {
    expect(getInvitationStatus(base, NOW)).toBe("pending");
  });

  it("est expirée à l'instant exact de l'expiration", () => {
    expect(getInvitationStatus({ ...base, expiresAt: NOW }, NOW)).toBe("expired");
  });

  it("est expirée après la date d'expiration", () => {
    expect(getInvitationStatus({ ...base, expiresAt: new Date(NOW.getTime() - HOUR) }, NOW)).toBe(
      "expired",
    );
  });

  it("est acceptée même si la date d'expiration est passée", () => {
    const expired = new Date(NOW.getTime() - HOUR);
    expect(getInvitationStatus({ ...base, acceptedAt: NOW, expiresAt: expired }, NOW)).toBe(
      "accepted",
    );
  });

  it("est révoquée même si la date d'expiration est passée", () => {
    const expired = new Date(NOW.getTime() - HOUR);
    expect(getInvitationStatus({ ...base, revokedAt: NOW, expiresAt: expired }, NOW)).toBe(
      "revoked",
    );
  });
});

describe("createInvitation", () => {
  const input = { email: EMAIL, tokenHash: TOKEN_HASH, invitedBy: ADMIN_ID };

  it("révoque d'abord les invitations en attente de cet email, puis insère", async () => {
    const { db, query } = makeFakeDb();
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: INVITATION_ID, email: EMAIL, expires_at: EXPIRES_AT }] });
    await createInvitation(db, input);
    expect(query.mock.calls).toHaveLength(2);
    expect(query.mock.calls[0]?.[0]).toContain("revoked_at = now()");
    expect(query.mock.calls[0]?.[1]).toEqual([EMAIL]);
    expect(query.mock.calls[1]?.[1]).toEqual([
      EMAIL,
      TOKEN_HASH,
      ADMIN_ID,
      INVITATION_TTL_SECONDS,
    ]);
  });

  it("renvoie l'identifiant, l'email et la date d'expiration", async () => {
    const { db, query } = makeFakeDb();
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: INVITATION_ID, email: EMAIL, expires_at: EXPIRES_AT }] });
    expect(await createInvitation(db, input)).toEqual({
      id: INVITATION_ID,
      email: EMAIL,
      expiresAt: EXPIRES_AT,
    });
  });

  it("renvoie null quand un compte existe déjà (aucune ligne insérée)", async () => {
    const { db } = makeFakeDb();
    expect(await createInvitation(db, input)).toBeNull();
  });

  it("vérifie dans la requête qu'aucun compte n'existe pour cet email", async () => {
    const { db, query } = makeFakeDb();
    await createInvitation(db, input);
    expect(query.mock.calls[1]?.[0]).toContain('NOT EXISTS (SELECT 1 FROM "user"');
  });

  it("n'écrit ni l'email ni le hash dans le texte SQL", async () => {
    const { db, query } = makeFakeDb();
    await createInvitation(db, input);
    for (const call of query.mock.calls) {
      expect(call[0]).not.toContain(EMAIL);
    }
  });

  it("refuse une ligne mal formée", async () => {
    const { db, query } = makeFakeDb();
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: "pas-un-uuid", email: EMAIL, expires_at: EXPIRES_AT }] });
    await expect(createInvitation(db, input)).rejects.toThrow();
  });
});

describe("findPendingInvitation", () => {
  it("renvoie l'invitation utilisable", async () => {
    const { db } = makeFakeDb([{ id: INVITATION_ID, email: EMAIL, expires_at: EXPIRES_AT }]);
    expect(await findPendingInvitation(db, TOKEN_HASH)).toEqual({
      id: INVITATION_ID,
      email: EMAIL,
      expiresAt: EXPIRES_AT,
    });
  });

  it("renvoie null quand aucune invitation ne correspond", async () => {
    const { db } = makeFakeDb();
    expect(await findPendingInvitation(db, TOKEN_HASH)).toBeNull();
  });

  it("exclut les invitations acceptées, révoquées et expirées dans la requête", async () => {
    const { db, query } = makeFakeDb();
    await findPendingInvitation(db, TOKEN_HASH);
    const call = query.mock.lastCall;
    expect(call?.[0]).toContain("accepted_at IS NULL");
    expect(call?.[0]).toContain("revoked_at IS NULL");
    expect(call?.[0]).toContain("expires_at > now()");
    expect(call?.[0]).not.toContain("FOR UPDATE");
    expect(call?.[1]).toEqual([TOKEN_HASH]);
  });
});

describe("lockPendingInvitation", () => {
  it("applique les mêmes conditions avec un verrou de ligne", async () => {
    const { db, query } = makeFakeDb();
    await lockPendingInvitation(db, TOKEN_HASH);
    const call = query.mock.lastCall;
    expect(call?.[0]).toContain("expires_at > now()");
    expect(call?.[0]).toContain("FOR UPDATE");
    expect(call?.[1]).toEqual([TOKEN_HASH]);
  });
});

describe("markInvitationAccepted", () => {
  it("renvoie true quand l'invitation a été marquée", async () => {
    const { db, query } = makeFakeDb([{ id: INVITATION_ID }]);
    expect(await markInvitationAccepted(db, INVITATION_ID)).toBe(true);
    expect(query.mock.lastCall?.[1]).toEqual([INVITATION_ID]);
  });

  it("renvoie false quand elle n'est plus utilisable", async () => {
    const { db } = makeFakeDb();
    expect(await markInvitationAccepted(db, INVITATION_ID)).toBe(false);
  });

  it("ne marque que les invitations encore utilisables", async () => {
    const { db, query } = makeFakeDb();
    await markInvitationAccepted(db, INVITATION_ID);
    const sql = query.mock.lastCall?.[0];
    expect(sql).toContain("accepted_at IS NULL");
    expect(sql).toContain("revoked_at IS NULL");
    expect(sql).toContain("expires_at > now()");
  });
});

describe("revokeInvitation", () => {
  it("renvoie true quand l'invitation a été révoquée", async () => {
    const { db } = makeFakeDb([{ id: INVITATION_ID }]);
    expect(await revokeInvitation(db, INVITATION_ID, ADMIN_ID)).toBe(true);
  });

  it("renvoie false quand l'invitation n'existe pas, n'est pas à cet admin ou n'est plus en attente", async () => {
    const { db } = makeFakeDb();
    expect(await revokeInvitation(db, INVITATION_ID, ADMIN_ID)).toBe(false);
  });

  it("vérifie la propriété dans la requête (§5.6)", async () => {
    const { db, query } = makeFakeDb();
    await revokeInvitation(db, INVITATION_ID, ADMIN_ID);
    const call = query.mock.lastCall;
    expect(call?.[0]).toContain("invited_by = $2");
    expect(call?.[1]).toEqual([INVITATION_ID, ADMIN_ID]);
  });
});

describe("listInvitations", () => {
  const rowBase = { id: INVITATION_ID, email: EMAIL, created_at: NOW };

  it("calcule le statut de chaque invitation", async () => {
    const past = new Date(NOW.getTime() - HOUR);
    const { db } = makeFakeDb([
      { ...rowBase, expires_at: EXPIRES_AT, accepted_at: null, revoked_at: null },
      { ...rowBase, expires_at: EXPIRES_AT, accepted_at: NOW, revoked_at: null },
      { ...rowBase, expires_at: EXPIRES_AT, accepted_at: null, revoked_at: NOW },
      { ...rowBase, expires_at: past, accepted_at: null, revoked_at: null },
    ]);
    const list = await listInvitations(db, ADMIN_ID, NOW);
    expect(list.map((item) => item.status)).toEqual(["pending", "accepted", "revoked", "expired"]);
  });

  it("n'expose ni jeton ni empreinte", async () => {
    const { db } = makeFakeDb([
      {
        ...rowBase,
        expires_at: EXPIRES_AT,
        accepted_at: null,
        revoked_at: null,
        token_hash: "secret",
      },
    ]);
    const list = await listInvitations(db, ADMIN_ID, NOW);
    expect(JSON.stringify(list)).not.toContain("secret");
  });

  it("filtre par propriétaire, du plus récent au plus ancien, avec une limite", async () => {
    const { db, query } = makeFakeDb();
    await listInvitations(db, ADMIN_ID, NOW);
    const call = query.mock.lastCall;
    expect(call?.[0]).toContain("invited_by = $1");
    expect(call?.[0]).toContain("ORDER BY created_at DESC");
    expect(call?.[1]).toEqual([ADMIN_ID, INVITATION_LIST_LIMIT]);
  });

  it("renvoie une liste vide sans invitation", async () => {
    const { db } = makeFakeDb();
    expect(await listInvitations(db, ADMIN_ID, NOW)).toEqual([]);
  });
});