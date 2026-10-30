import { describe, expect, it } from "vitest";
import { parseEnv } from "@/lib/env";
import { ConfigError } from "@/lib/errors";

const valid = {
  NODE_ENV: "test",
  DATABASE_URL: "postgres://u:p@localhost:5432/db",
  AUTH_SECRET: "a".repeat(32),
};

/** Retourne le message de l'erreur levée par `fn`, ou "" si rien n'est levé. */
function messageOf(fn: () => unknown): string {
  try {
    fn();
  } catch (error) {
    return error instanceof Error ? error.message : "";
  }
  return "";
}

describe("parseEnv", () => {
  it("accepte une configuration valide", () => {
    expect(parseEnv(valid).DATABASE_URL).toBe(valid.DATABASE_URL);
  });

  it("refuse une variable manquante", () => {
    const withoutDatabaseUrl = { NODE_ENV: valid.NODE_ENV, AUTH_SECRET: valid.AUTH_SECRET };
    expect(() => parseEnv(withoutDatabaseUrl)).toThrow(ConfigError);
  });

  it("refuse un AUTH_SECRET trop court", () => {
    expect(() => parseEnv({ ...valid, AUTH_SECRET: "court" })).toThrow(ConfigError);
  });

  it("nomme la variable fautive sans divulguer sa valeur", () => {
    const message = messageOf(() => parseEnv({ ...valid, AUTH_SECRET: "court" }));
    expect(message).toContain("AUTH_SECRET");
    expect(message).not.toContain("court");
  });
});