import { describe, expect, it } from "vitest";
import { parseEnv } from "./env";
import { ConfigError } from "./errors";

const base = {
  NODE_ENV: "development",
  DATABASE_URL: "postgres://u:p@localhost:5432/db",
  AUTH_SECRET: "a".repeat(32),
  APP_URL: "http://localhost:3000",
  SMTP_HOST: "localhost",
  SMTP_PORT: "25",
  EMAIL_FROM: "REF-Archives <no-reply@example.com>",
};

describe("parseEnv — variables email", () => {
  it("accepte un relais sans authentification et applique les valeurs par défaut", () => {
    const env = parseEnv(base);
    expect(env.SMTP_PORT).toBe(25);
    expect(env.SMTP_SECURE).toBe(false);
    expect(env.SMTP_USER).toBeUndefined();
    expect(env.SMTP_PASSWORD).toBeUndefined();
  });

  it("traite SMTP_USER et SMTP_PASSWORD vides comme absents", () => {
    const env = parseEnv({ ...base, SMTP_USER: "", SMTP_PASSWORD: "" });
    expect(env.SMTP_USER).toBeUndefined();
    expect(env.SMTP_PASSWORD).toBeUndefined();
  });

  it("accepte un compte complet et SMTP_SECURE=true", () => {
    const env = parseEnv({ ...base, SMTP_USER: "bob", SMTP_PASSWORD: "pw", SMTP_SECURE: "true" });
    expect(env.SMTP_USER).toBe("bob");
    expect(env.SMTP_SECURE).toBe(true);
  });

  it("refuse SMTP_USER sans SMTP_PASSWORD", () => {
    expect(() => parseEnv({ ...base, SMTP_USER: "bob" })).toThrow(ConfigError);
    expect(() => parseEnv({ ...base, SMTP_USER: "bob" })).toThrow(/SMTP_PASSWORD/);
  });

  it("refuse SMTP_PASSWORD sans SMTP_USER, sans révéler sa valeur", () => {
    const attempt = () => parseEnv({ ...base, SMTP_PASSWORD: "super-secret" });
    expect(attempt).toThrow(/SMTP_USER/);
    expect(attempt).not.toThrow(/super-secret/);
  });

  it("refuse un port invalide", () => {
    expect(() => parseEnv({ ...base, SMTP_PORT: "abc" })).toThrow(/SMTP_PORT/);
    expect(() => parseEnv({ ...base, SMTP_PORT: "70000" })).toThrow(/SMTP_PORT/);
  });

  it("refuse SMTP_SECURE autre que true/false", () => {
    expect(() => parseEnv({ ...base, SMTP_SECURE: "oui" })).toThrow(/SMTP_SECURE/);
  });

  it("refuse EMAIL_FROM avec saut de ligne ou sans adresse", () => {
    expect(() => parseEnv({ ...base, EMAIL_FROM: "pas-une-adresse" })).toThrow(/EMAIL_FROM/);
    expect(() => parseEnv({ ...base, EMAIL_FROM: "a@example.com\nBcc: b@example.com" })).toThrow(
      /EMAIL_FROM/,
    );
  });

  it("retire le slash final de APP_URL", () => {
    expect(parseEnv({ ...base, APP_URL: "http://localhost:3000/" }).APP_URL).toBe(
      "http://localhost:3000",
    );
  });

  it("refuse un APP_URL qui n'est pas http(s)", () => {
    expect(() => parseEnv({ ...base, APP_URL: "ftp://example.com" })).toThrow(/APP_URL/);
  });

  it("exige https pour APP_URL en production", () => {
    expect(() => parseEnv({ ...base, NODE_ENV: "production" })).toThrow(/APP_URL/);
    expect(parseEnv({ ...base, NODE_ENV: "production", APP_URL: "https://ref.example.com" }).APP_URL).toBe(
      "https://ref.example.com",
    );
  });
});