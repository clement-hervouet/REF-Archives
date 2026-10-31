import { describe, expect, it } from "vitest";
import { makeFakeDb } from "./fake-db";
import { EmailAlreadyUsedError, createUser, findUserCredentialsByEmail } from "./users";

const USER_ID = "3f0c1d52-9b0a-4c55-8a3e-2f6f3a1c9e11";
const HASH = "$argon2id$v=19$m=65536,t=3,p=4$fake$fake";

describe("createUser", () => {
  it("insère l'utilisateur et renvoie id, email et rôle", async () => {
    const { db } = makeFakeDb([{ id: USER_ID, email: "clem@example.com", role: "admin" }]);
    const result = await createUser(db, {
      email: "clem@example.com",
      passwordHash: HASH,
      role: "admin",
    });
    // toEqual échoue si un champ en trop (ex. password_hash) fuit dans le résultat.
    expect(result).toEqual({ id: USER_ID, email: "clem@example.com", role: "admin" });
  });

  it("utilise une requête paramétrée dans l'ordre email, hash, rôle", async () => {
    const { db, query } = makeFakeDb([{ id: USER_ID, email: "clem@example.com", role: "user" }]);
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
    const { db, query } = makeFakeDb([{ id: USER_ID, email: evil, role: "user" }]);
    await createUser(db, { email: evil, passwordHash: HASH, role: "user" });
    const call = query.mock.lastCall;
    expect(call?.[0]).not.toContain("DROP");
    expect(call?.[1]).toEqual([evil, HASH, "user"]);
  });

  it("traduit la violation d'unicité PostgreSQL en EmailAlreadyUsedError", async () => {
    const { db, query } = makeFakeDb();
    query.mockRejectedValue(Object.assign(new Error("duplicate key"), { code: "23505" }));
    await expect(
      createUser(db, { email: "clem@example.com", passwordHash: HASH, role: "admin" }),
    ).rejects.toBeInstanceOf(EmailAlreadyUsedError);
  });

  it("relance telle quelle toute autre erreur de la base", async () => {
    const { db, query } = makeFakeDb();
    const failure = Object.assign(new Error("connexion perdue"), { code: "08006" });
    query.mockRejectedValue(failure);
    await expect(
      createUser(db, { email: "clem@example.com", passwordHash: HASH, role: "admin" }),
    ).rejects.toBe(failure);
  });

  it("refuse une ligne dont le rôle est inconnu", async () => {
    const { db } = makeFakeDb([{ id: USER_ID, email: "clem@example.com", role: "root" }]);
    await expect(
      createUser(db, { email: "clem@example.com", passwordHash: HASH, role: "admin" }),
    ).rejects.toThrow();
  });

  it("refuse une réponse sans ligne", async () => {
    const { db } = makeFakeDb();
    await expect(
      createUser(db, { email: "clem@example.com", passwordHash: HASH, role: "admin" }),
    ).rejects.toThrow();
  });
});

describe("findUserCredentialsByEmail", () => {
  it("renvoie l'identifiant et le hash", async () => {
    const { db } = makeFakeDb([{ id: USER_ID, password_hash: HASH }]);
    const result = await findUserCredentialsByEmail(db, "clem@example.com");
    expect(result).toEqual({ userId: USER_ID, passwordHash: HASH });
  });

  it("renvoie null quand l'email n'existe pas", async () => {
    const { db } = makeFakeDb();
    expect(await findUserCredentialsByEmail(db, "inconnu@example.com")).toBeNull();
  });

  it("passe l'email en paramètre, comparé sans tenir compte de la casse", async () => {
    const { db, query } = makeFakeDb([{ id: USER_ID, password_hash: HASH }]);
    await findUserCredentialsByEmail(db, "clem@example.com");
    const call = query.mock.lastCall;
    expect(call?.[0]).toContain("lower(email) = lower($1)");
    expect(call?.[0]).not.toContain("clem@example.com");
    expect(call?.[1]).toEqual(["clem@example.com"]);
  });

  it("transmet une valeur hostile comme paramètre, jamais dans le SQL", async () => {
    const evil = "' OR 1=1 --";
    const { db, query } = makeFakeDb();
    await findUserCredentialsByEmail(db, evil);
    const call = query.mock.lastCall;
    expect(call?.[0]).not.toContain("OR 1=1");
    expect(call?.[1]).toEqual([evil]);
  });

  it("refuse une ligne mal formée", async () => {
    const { db } = makeFakeDb([{ id: "pas-un-uuid", password_hash: HASH }]);
    await expect(findUserCredentialsByEmail(db, "clem@example.com")).rejects.toThrow();
  });
});