import { describe, expect, it } from "vitest";
import {
  ACCESS_REQUEST_PENDING_LIMIT,
  countPendingAccessRequests,
  decideAccessRequest,
  insertAccessRequest,
  listPendingAccessRequests,
  lockPendingAccessRequest,
} from "./access-requests";
import { makeFakeDb } from "./fake-db";

const REQUEST_ID = "6a1f0c3e-2b4d-4e5f-8a9b-0c1d2e3f4a5b";
const ADMIN_ID = "3f0c1d52-9b0a-4c55-8a3e-2f6f3a1c9e11";
const EMAIL = "demande@example.com";
const CREATED_AT = new Date("2026-11-15T09:00:00.000Z");
const REQUEST = { email: EMAIL, firstname: "Léa", lastname: "Martin" };

describe("insertAccessRequest", () => {
  it("insère avec des paramètres, sans aucune valeur dans le texte SQL", async () => {
    const { db, query } = makeFakeDb([{ id: REQUEST_ID }]);
    expect(await insertAccessRequest(db, REQUEST)).toBe(true);
    const [sql, values] = query.mock.calls[0] ?? [];
    expect(values).toEqual([EMAIL, "Léa", "Martin", ACCESS_REQUEST_PENDING_LIMIT]);
    expect(sql).not.toContain(EMAIL);
    expect(sql).not.toContain("Léa");
  });

  it("n'insère rien si un compte existe, si une demande attend déjà ou si la liste est pleine", async () => {
    const { db, query } = makeFakeDb();
    await insertAccessRequest(db, REQUEST);
    const sql = query.mock.calls[0]?.[0] ?? "";
    expect(sql).toContain(`NOT EXISTS (SELECT 1 FROM "user" WHERE lower(email) = lower($1))`);
    expect(sql).toContain("WHERE decided_at IS NULL) < $4::integer");
    expect(sql).toContain("ON CONFLICT (lower(email)) WHERE decided_at IS NULL DO NOTHING");
  });

  it("renvoie false quand la demande est ignorée (aucune ligne)", async () => {
    const { db } = makeFakeDb();
    expect(await insertAccessRequest(db, REQUEST)).toBe(false);
  });
});

describe("listPendingAccessRequests", () => {
  it("lit les demandes en attente, de la plus ancienne à la plus récente, avec une limite", async () => {
    const { db, query } = makeFakeDb([
      {
        id: REQUEST_ID,
        email: EMAIL,
        firstname: "Léa",
        lastname: "Martin",
        created_at: CREATED_AT,
      },
    ]);
    expect(await listPendingAccessRequests(db)).toEqual([
      { id: REQUEST_ID, email: EMAIL, firstname: "Léa", lastname: "Martin", createdAt: CREATED_AT },
    ]);
    const [sql, values] = query.mock.calls[0] ?? [];
    expect(sql).toContain("WHERE decided_at IS NULL");
    expect(sql).toContain("ORDER BY created_at, id");
    expect(values).toEqual([ACCESS_REQUEST_PENDING_LIMIT]);
  });

  it("refuse une ligne mal formée", async () => {
    const { db } = makeFakeDb([{ id: "pas-un-uuid", email: EMAIL }]);
    await expect(listPendingAccessRequests(db)).rejects.toThrow();
  });
});

describe("countPendingAccessRequests", () => {
  it("compte seulement les demandes en attente", async () => {
    const { db, query } = makeFakeDb([{ count: 3 }]);
    expect(await countPendingAccessRequests(db)).toBe(3);
    expect(query.mock.calls[0]?.[0]).toContain("WHERE decided_at IS NULL");
  });
});

describe("lockPendingAccessRequest", () => {
  it("verrouille la demande encore en attente et renvoie son email", async () => {
    const { db, query } = makeFakeDb([{ id: REQUEST_ID, email: EMAIL }]);
    expect(await lockPendingAccessRequest(db, REQUEST_ID)).toEqual({
      id: REQUEST_ID,
      email: EMAIL,
    });
    const [sql, values] = query.mock.calls[0] ?? [];
    expect(sql).toContain("decided_at IS NULL");
    expect(sql).toContain("FOR UPDATE");
    expect(values).toEqual([REQUEST_ID]);
  });

  it("renvoie null pour une demande inconnue ou déjà traitée", async () => {
    const { db } = makeFakeDb();
    expect(await lockPendingAccessRequest(db, REQUEST_ID)).toBeNull();
  });
});

describe("decideAccessRequest", () => {
  it("clôt une demande en attente avec l'admin et la décision", async () => {
    const { db, query } = makeFakeDb([{ id: REQUEST_ID }]);
    expect(
      await decideAccessRequest(db, {
        requestId: REQUEST_ID,
        adminId: ADMIN_ID,
        decision: "refused",
      }),
    ).toBe(true);
    const [sql, values] = query.mock.calls[0] ?? [];
    expect(sql).toContain("WHERE id = $1 AND decided_at IS NULL");
    expect(values).toEqual([REQUEST_ID, ADMIN_ID, "refused"]);
  });

  it("renvoie false si la demande a déjà été traitée", async () => {
    const { db } = makeFakeDb();
    expect(
      await decideAccessRequest(db, {
        requestId: REQUEST_ID,
        adminId: ADMIN_ID,
        decision: "invited",
      }),
    ).toBe(false);
  });
});
