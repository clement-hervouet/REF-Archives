import { describe, expect, it } from "vitest";
import {
  buildContentSecurityPolicy,
  expectedHostFromAppUrl,
  generateNonce,
  getSecurityHeaders,
  isAllowedHost,
} from "./security-headers";

const NONCE = "bm9uY2UtZGUtdGVzdA==";

/** Renvoie une directive de la CSP par son nom, ou `undefined`. */
function directive(csp: string, name: string): string | undefined {
  return csp.split("; ").find((part) => part === name || part.startsWith(`${name} `));
}

describe("generateNonce", () => {
  it("produit une chaîne base64 de 48 caractères", () => {
    expect(generateNonce()).toMatch(/^[A-Za-z0-9+/]{48}$/);
  });

  it("ne produit jamais deux fois le même nonce", () => {
    const nonces = new Set(Array.from({ length: 100 }, () => generateNonce()));
    expect(nonces.size).toBe(100);
  });
});

describe("buildContentSecurityPolicy en production", () => {
  const csp = buildContentSecurityPolicy({ nonce: NONCE, isDevelopment: false });

  it("n'autorise les scripts que par nonce, avec strict-dynamic", () => {
    const scriptSrc = directive(csp, "script-src");
    expect(scriptSrc).toContain(`'nonce-${NONCE}'`);
    expect(scriptSrc).toContain("'strict-dynamic'");
  });

  it("n'autorise ni unsafe-inline ni unsafe-eval", () => {
    expect(csp).not.toContain("unsafe-inline");
    expect(csp).not.toContain("unsafe-eval");
  });

  it("protège aussi les styles par nonce", () => {
    expect(directive(csp, "style-src")).toBe(`style-src 'self' 'nonce-${NONCE}'`);
  });

  it("restreint tout le reste au site lui-même", () => {
    expect(directive(csp, "default-src")).toBe("default-src 'self'");
    expect(directive(csp, "connect-src")).toBe("connect-src 'self'");
    expect(directive(csp, "font-src")).toBe("font-src 'self'");
  });

  it("n'autorise le service worker et le manifeste que depuis le site", () => {
    expect(directive(csp, "worker-src")).toBe("worker-src 'self'");
    expect(directive(csp, "manifest-src")).toBe("manifest-src 'self'");
  });

  it("interdit les objets, les <base> externes, les cadres et les formulaires vers l'extérieur", () => {
    expect(directive(csp, "object-src")).toBe("object-src 'none'");
    expect(directive(csp, "base-uri")).toBe("base-uri 'self'");
    expect(directive(csp, "form-action")).toBe("form-action 'self'");
    expect(directive(csp, "frame-ancestors")).toBe("frame-ancestors 'none'");
  });

  it("ne contient aucun joker ni domaine externe", () => {
    expect(csp).not.toMatch(/(^|\s)\*(\s|;|$)/);
    expect(csp).not.toContain("http:");
    expect(csp).not.toContain("https:");
  });

  it("n'impose pas upgrade-insecure-requests (casserait les tests locaux en HTTP)", () => {
    expect(csp).not.toContain("upgrade-insecure-requests");
  });
});

describe("buildContentSecurityPolicy en développement", () => {
  const csp = buildContentSecurityPolicy({ nonce: NONCE, isDevelopment: true });

  it("autorise eval pour le rechargement à chaud, mais garde le nonce pour les scripts", () => {
    const scriptSrc = directive(csp, "script-src");
    expect(scriptSrc).toContain("'unsafe-eval'");
    expect(scriptSrc).toContain(`'nonce-${NONCE}'`);
  });

  it("autorise les styles injectés, sans nonce (sinon unsafe-inline serait ignoré)", () => {
    expect(directive(csp, "style-src")).toBe("style-src 'self' 'unsafe-inline'");
  });

  it("autorise les WebSocket du rechargement à chaud", () => {
    expect(directive(csp, "connect-src")).toBe("connect-src 'self' ws: wss:");
  });

  it("garde les restrictions de fond", () => {
    expect(directive(csp, "object-src")).toBe("object-src 'none'");
    expect(directive(csp, "frame-ancestors")).toBe("frame-ancestors 'none'");
  });
});

describe("getSecurityHeaders", () => {
  it("renvoie les en-têtes de base", () => {
    const headers = getSecurityHeaders("/");
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["Cross-Origin-Opener-Policy"]).toBe("same-origin");
    expect(headers["Cross-Origin-Resource-Policy"]).toBe("same-origin");
    expect(headers["Permissions-Policy"]).toContain("camera=()");
  });

  it("limite le Referer par défaut", () => {
    expect(getSecurityHeaders("/")["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(getSecurityHeaders("/admin/invitations")["Referrer-Policy"]).toBe(
      "strict-origin-when-cross-origin",
    );
  });

  it("supprime le Referer sur les chemins qui contiennent un jeton", () => {
    expect(getSecurityHeaders("/invitation/abc")["Referrer-Policy"]).toBe("no-referrer");
    expect(getSecurityHeaders("/invitation")["Referrer-Policy"]).toBe("no-referrer");
    expect(getSecurityHeaders("/api/ical/abc.ics")["Referrer-Policy"]).toBe("no-referrer");
  });

  it("supprime le Referer sur la page de réinitialisation (jeton dans l'URL)", () => {
    // Le jeton de reset vit dans le chemin, comme pour /invitation : il ne doit jamais
    // fuiter par le Referer (intention déclarée dans security-headers.ts).
    expect(getSecurityHeaders("/reset-password/abc123")["Referrer-Policy"]).toBe("no-referrer");
    expect(getSecurityHeaders("/reset-password")["Referrer-Policy"]).toBe("no-referrer");
  });

  it("ne confond pas /reset-password avec un chemin voisin", () => {
    expect(getSecurityHeaders("/reset-passwords/x")["Referrer-Policy"]).toBe(
      "strict-origin-when-cross-origin",
    );
  });

  it("ne confond pas un préfixe avec un chemin voisin", () => {
    expect(getSecurityHeaders("/invitations")["Referrer-Policy"]).toBe(
      "strict-origin-when-cross-origin",
    );
    expect(getSecurityHeaders("/invitationx/abc")["Referrer-Policy"]).toBe(
      "strict-origin-when-cross-origin",
    );
  });
});

describe("expectedHostFromAppUrl", () => {
  it("extrait l'hôte sans le port, en minuscules", () => {
    expect(expectedHostFromAppUrl("https://REF.example.com:8443")).toBe("ref.example.com");
    expect(expectedHostFromAppUrl("http://localhost:3000")).toBe("localhost");
  });

  it("renvoie null si APP_URL est absent ou invalide", () => {
    expect(expectedHostFromAppUrl(undefined)).toBeNull();
    expect(expectedHostFromAppUrl("")).toBeNull();
    expect(expectedHostFromAppUrl("pas-une-url")).toBeNull();
  });
});

describe("isAllowedHost", () => {
  const prod = { expectedHost: "ref.example.com", isDevelopment: false };

  it("accepte l'hôte attendu, quel que soit le port ou la casse", () => {
    expect(isAllowedHost("ref.example.com", prod)).toBe(true);
    expect(isAllowedHost("ref.example.com:443", prod)).toBe(true);
    expect(isAllowedHost("REF.Example.com", prod)).toBe(true);
  });

  it("accepte les hôtes loopback (healthcheck Docker interne)", () => {
    expect(isAllowedHost("localhost:3000", prod)).toBe(true);
    expect(isAllowedHost("127.0.0.1", prod)).toBe(true);
    expect(isAllowedHost("[::1]:3000", prod)).toBe(true);
  });

  it("refuse en production un Host inattendu ou absent", () => {
    expect(isAllowedHost("evil.example", prod)).toBe(false);
    expect(isAllowedHost("203.0.113.9", prod)).toBe(false);
    expect(isAllowedHost(null, prod)).toBe(false);
    expect(isAllowedHost("", prod)).toBe(false);
  });

  it("ne bloque jamais en développement", () => {
    expect(
      isAllowedHost("evil.example", { expectedHost: "ref.example.com", isDevelopment: true }),
    ).toBe(true);
  });

  it("laisse passer (fail open) si l'hôte attendu est inconnu", () => {
    expect(isAllowedHost("evil.example", { expectedHost: null, isDevelopment: false })).toBe(true);
  });
});
