import { describe, expect, it } from "vitest";
import { parseEnv } from "@/lib/env";
import { ConfigError } from "@/lib/errors";

const base = {
  NODE_ENV: "test",
  DATABASE_URL: "postgres://u:p@localhost:5432/db",
  AUTH_SECRET: "a".repeat(32),
  APP_URL: "http://localhost:3000",
  SMTP_HOST: "localhost",
  SMTP_PORT: "25",
  EMAIL_FROM: "REF-Archives <no-reply@example.com>",
};

describe("parseEnv — CRON_SECRET", () => {
  it("est facultatif : absent ou vide, les rappels sont désactivés", () => {
    expect(parseEnv(base).CRON_SECRET).toBeUndefined();
    expect(parseEnv({ ...base, CRON_SECRET: "" }).CRON_SECRET).toBeUndefined();
  });

  it("accepte un secret d'au moins 32 caractères", () => {
    expect(parseEnv({ ...base, CRON_SECRET: "c".repeat(32) }).CRON_SECRET).toBe("c".repeat(32));
  });

  it("refuse un secret trop court sans divulguer sa valeur", () => {
    let message = "";
    try {
      parseEnv({ ...base, CRON_SECRET: "trop-court-123" });
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      message = error instanceof Error ? error.message : "";
    }
    expect(message).toContain("CRON_SECRET");
    expect(message).not.toContain("trop-court-123");
  });
});
