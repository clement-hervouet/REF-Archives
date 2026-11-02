import { describe, expect, it } from "vitest";
import { SESSION_COOKIE_NAMES, isPublicPath } from "./public-paths";

describe("isPublicPath", () => {
  it("autorise les routes publiques et leurs sous-chemins", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/invitation/abc")).toBe(true);
    expect(isPublicPath("/api/auth/session")).toBe(true);
    expect(isPublicPath("/api/auth/callback/credentials")).toBe(true);
    expect(isPublicPath("/api/ical/abc.ics")).toBe(true);
    expect(isPublicPath("/api/health")).toBe(true);
  });

  it("refuse les pages de l'application", () => {
    expect(isPublicPath("/")).toBe(false);
    expect(isPublicPath("/admin/invitations")).toBe(false);
  });

  it("ne confond pas un préfixe avec un chemin voisin", () => {
    expect(isPublicPath("/loginx")).toBe(false);
    expect(isPublicPath("/invitations")).toBe(false);
    expect(isPublicPath("/api/authz")).toBe(false);
    expect(isPublicPath("/api/auth-bypass")).toBe(false);
    expect(isPublicPath("/api/icalendar")).toBe(false);
  });

  it("ne rend pas publique une page qui contient seulement le nom d'une route publique", () => {
    expect(isPublicPath("/admin/login")).toBe(false);
    expect(isPublicPath("/app/invitation/abc")).toBe(false);
  });

  it("est sensible à la casse, comme le routage de Next.js", () => {
    expect(isPublicPath("/Login")).toBe(false);
  });
});

describe("SESSION_COOKIE_NAMES", () => {
  it("couvre le cookie HTTP et le cookie HTTPS d'Auth.js", () => {
    expect(SESSION_COOKIE_NAMES).toEqual([
      "authjs.session-token",
      "__Secure-authjs.session-token",
    ]);
  });
});