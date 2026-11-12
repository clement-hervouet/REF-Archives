import { describe, expect, it } from "vitest";
import { buildSessionCookie } from "./session-cookie";

describe("buildSessionCookie", () => {
  it("fige toujours httpOnly, sameSite lax et path /", () => {
    const { options } = buildSessionCookie({ nodeEnv: "development", appUrl: "http://localhost:3000" });
    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe("lax");
    expect(options.path).toBe("/");
  });

  it("en dev http, n'est pas secure et garde le nom sans préfixe", () => {
    // En http://localhost, un cookie Secure serait refusé par le navigateur : la connexion
    // de développement doit continuer à fonctionner.
    const cookie = buildSessionCookie({ nodeEnv: "development", appUrl: "http://localhost:3000" });
    expect(cookie.options.secure).toBe(false);
    expect(cookie.name).toBe("authjs.session-token");
  });

  it("en production, est secure et préfixé __Secure-", () => {
    const cookie = buildSessionCookie({ nodeEnv: "production", appUrl: "https://example.test" });
    expect(cookie.options.secure).toBe(true);
    expect(cookie.name).toBe("__Secure-authjs.session-token");
  });

  it("hors production mais avec un APP_URL https, est secure et préfixé", () => {
    const cookie = buildSessionCookie({ nodeEnv: "development", appUrl: "https://staging.test" });
    expect(cookie.options.secure).toBe(true);
    expect(cookie.name).toBe("__Secure-authjs.session-token");
  });

  it("sans APP_URL hors production, reste non secure", () => {
    const cookie = buildSessionCookie({ nodeEnv: "test", appUrl: undefined });
    expect(cookie.options.secure).toBe(false);
    expect(cookie.name).toBe("authjs.session-token");
  });
});
