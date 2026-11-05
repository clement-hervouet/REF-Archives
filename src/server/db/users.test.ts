import { describe, expect, it } from "vitest";
import { makeFakeDb } from "./fake-db";
import {
  EmailAlreadyUsedError,
  createUser,
  findUserCredentialsByEmail,
  updateUserProfile,
} from "./users";

const USER_ID = "3f0c1d52-9b0a-4c55-8a3e-2f6f3a1c9e11";
const HASH = "$argon2id$v=19$m=65536,t=3,p=4$fake$fake";
const NO_NAME = { firstname: null, lastname: null };
const NEW_USER = { email: "clem@example.com", passwordHash: HASH, ...NO_NAME };

describe("createUser", () => {
  it("insère l'utilisateur et renvoie id, email et rôle", async () => {
    const { db } = makeFakeDb([{ id: USER_ID, email: "clem@example.com", role: "admin" }]);
    const result = await createUser(db, {
      email: "clem@example.com",
      passwordHash: HASH,
      role: "admin",
      ...NO_NAME,
    });
    // toEqual échoue si un champ en trop (ex. password_hash) fuit dans le résultat.
    expect(result).toEqual({ id: USER_ID, email: "clem@example.com", role: "admin" });
  });

  it("utilise une requête paramétrée dans l'ordre email, hash, rôle", async () => {
    const { db, query } = makeFakeDb([{ id: USER_ID, email: "clem@example.com", role: "user" }]);
    await createUser(db, { ...NEW_USER, role: "user" });
    const call = query.mock.lastCall;
    expect(call?.[0]).toContain("$1");
    expect(call?.[0]).toContain("$2");
    expect(call?.[0]).toContain("$3");
    expect(call?.[0]).not.toContain("clem@example.com");
    expect(call?.[1]).toEqual(["clem@example.com", HASH, "user", null, null]);
  });

  it("transmet une valeur hostile comme paramètre, jamais dans le SQL", async () => {
    const evil = 'x\'); DROP TABLE "user"; --@example.com';
    const { db, query } = makeFakeDb([{ id: USER_ID, email: evil, role: "user" }]);
    await createUser(db, { email: evil, passwordHash: HASH, role: "user", ...NO_NAME });
    const call = query.mock.lastCall;
    expect(call?.[0]).not.toContain("DROP");
    expect(call?.[1]).toEqual([evil, HASH, "user", null, null]);
  });

  it("traduit la violation d'unicité PostgreSQL en EmailAlreadyUsedError", async () => {
    const { db, query } = makeFakeDb();
    query.mockRejectedValue(Object.assign(new Error("duplicate key"), { code: "23505" }));
    await expect(createUser(db, { ...NEW_USER, role: "admin" })).rejects.toBeInstanceOf(
      EmailAlreadyUsedError,
    );
  });

  it("relance telle quelle toute autre erreur de la base", async () => {
    const { db, query } = makeFakeDb();
    const failure = Object.assign(new Error("connexion perdue"), { code: "08006" });
    query.mockRejectedValue(failure);
    await expect(createUser(db, { ...NEW_USER, role: "admin" })).rejects.toBe(failure);
  });

  it("refuse une ligne dont le rôle est inconnu", async () => {
    const { db } = makeFakeDb([{ id: USER_ID, email: "clem@example.com", role: "root" }]);
    await expect(createUser(db, { ...NEW_USER, role: "admin" })).rejects.toThrow();
  });

  it("refuse une réponse sans ligne", async () => {
    const { db } = makeFakeDb();
    await expect(createUser(db, { ...NEW_USER, role: "admin" })).rejects.toThrow();
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

describe("updateUserProfile", () => {
  const PROFILE = { firstname: "Clément", lastname: "Hervouet" };

  it("enregistre le nom et le prénom de l'utilisateur donné", async () => {
    const { db, query } = makeFakeDb([{ id: USER_ID }]);
    expect(await updateUserProfile(db, USER_ID, PROFILE)).toBe(true);
    const call = query.mock.lastCall;
    expect(call?.[0]).toContain("WHERE id = $1");
    expect(call?.[1]).toEqual([USER_ID, "Clément", "Hervouet"]);
  });

  it("renvoie false quand le compte n'existe plus", async () => {
    const { db } = makeFakeDb();
    expect(await updateUserProfile(db, USER_ID, PROFILE)).toBe(false);
  });

  it("transmet une valeur hostile comme paramètre, jamais dans le SQL", async () => {
    const { db, query } = makeFakeDb([{ id: USER_ID }]);
    await updateUserProfile(db, USER_ID, { firstname: "'; DROP TABLE x; --", lastname: "x" });
    const call = query.mock.lastCall;
    expect(call?.[0]).not.toContain("DROP TABLE");
    expect(call?.[1]).toContain("'; DROP TABLE x; --");
  });
});
