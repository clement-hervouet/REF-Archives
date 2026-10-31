import { describe, expect, it, vi } from "vitest";
import { EmailAlreadyUsedError, createUser } from "./users";
import type { Queryable } from "./users";

const USER_ID = "3f0c1d52-9b0a-4c55-8a3e-2f6f3a1c9e11";
const HASH = "$argon2id$v=19$m=65536,t=3,p=4$fake$fake";

function makeDb(rows: Record<string, unknown>[]) {
  const query = vi.fn<Queryable["query"]>().mockResolvedValue({ rows });
  return { db: { query } satisfies Queryable, query };
}

describe("createUser", () => {
  it("insère l'utilisateur et renvoie id, email et rôle", async () => {
    const { db } = makeDb([{ id: USER_ID, email: "clem@example.com", role: "admin" }]);
    const result = await createUser(db, {
      email: "clem@example.com",
      passwordHash: HASH,
      role: "admin",
    });
    // toEqual échoue si un champ en trop (ex. password_hash) fuit dans le résultat.
    expect(result).toEqual({ id: USER_ID, email: "clem@example.com", role: "admin" });
  });

  it("utilise une requête paramétrée dans l'ordre email, hash, rôle", async () => {
    const { db, query } = makeDb([{ id: USER_ID, email: "clem@example.com", role: "user" }]);
    await createUser(db, { email: "clem@example.com", passwordHash: HASH, role: "user" });
    const call = query.mock.lastCall;
    expect(call?.[0]).toContain("$1");
    expect(call?.[0]).toContain("$2");
    expect(call?.[0]).toContain("$3");
    expect(call?.[0]).not.toContain("clem@example.com");
    expect(call?.[1]).toEqual(["clem@example.com", HASH, "user"]);
  });

  it("transmet une valeur hostile comme paramètre, jamais dans le SQL", async () => {
    const evil = "x'); DROP TABLE \"user\"; --@example.com";
    const { db, query } = makeDb([{ id: USER_ID, email: evil, role: "user" }]);
    await createUser(db, { email: evil, passwordHash: HASH, role: "user" });
    const call = query.mock.lastCall;
    expect(call?.[0]).not.toContain("DROP");
    expect(call?.[1]).toEqual([evil, HASH, "user"]);
  });

  it("traduit la violation d'unicité PostgreSQL en EmailAlreadyUsedError", async () => {
    const { db, query } = makeDb([]);
    query.mockRejectedValue(Object.assign(new Error("duplicate key"), { code: "23505" }));
    await expect(
      createUser(db, { email: "clem@example.com", passwordHash: HASH, role: "admin" }),
    ).rejects.toBeInstanceOf(EmailAlreadyUsedError);
  });

  it("relance telle quelle toute autre erreur de la base", async () => {
    const { db, query } = makeDb([]);
    const failure = Object.assign(new Error("connexion perdue"), { code: "08006" });
    query.mockRejectedValue(failure);
    await expect(
      createUser(db, { email: "clem@example.com", passwordHash: HASH, role: "admin" }),
    ).rejects.toBe(failure);
  });

  it("refuse une ligne dont le rôle est inconnu", async () => {
    const { db } = makeDb([{ id: USER_ID, email: "clem@example.com", role: "root" }]);
    await expect(
      createUser(db, { email: "clem@example.com", passwordHash: HASH, role: "admin" }),
    ).rejects.toThrow();
  });

  it("refuse une réponse sans ligne", async () => {
    const { db } = makeDb([]);
    await expect(
      createUser(db, { email: "clem@example.com", passwordHash: HASH, role: "admin" }),
    ).rejects.toThrow();
  });
});