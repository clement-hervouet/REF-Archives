import { describe, expect, it } from "vitest";
import {
  ACCOUNT_NAV,
  ADMIN_NAV,
  MOBILE_PANEL_NAV,
  MOBILE_TAB_NAV,
  PRIMARY_NAV,
  SECONDARY_NAV,
  isAnyNavItemActive,
  isNavItemActive,
  navItemBadgeCount,
  pendingRequestsLabel,
} from "./nav-items";

function item(href: string) {
  const found = [...PRIMARY_NAV, ...SECONDARY_NAV, ...ADMIN_NAV, ACCOUNT_NAV].find(
    (entry) => entry.href === href,
  );
  if (found === undefined) {
    throw new Error(`entrée absente : ${href}`);
  }
  return found;
}

describe("isNavItemActive", () => {
  it("n'active l'accueil que sur « / » exactement", () => {
    expect(isNavItemActive(item("/"), "/")).toBe(true);
    expect(isNavItemActive(item("/"), "/indemnites")).toBe(false);
  });

  it("active une entrée sur sa page et ses sous-pages", () => {
    expect(isNavItemActive(item("/indemnites"), "/indemnites")).toBe(true);
    expect(isNavItemActive(item("/indemnites"), "/indemnites/nouvelle")).toBe(true);
    expect(isNavItemActive(item("/indemnites"), "/indemnites/abc/match")).toBe(true);
  });

  it("ne confond pas deux chemins qui commencent pareil", () => {
    expect(isNavItemActive(item("/notes"), "/notes-archivees")).toBe(false);
    expect(isNavItemActive(item("/baremes"), "/admin/bareme-commun")).toBe(false);
  });

  it("active « Préparation de match » sur la liste et sur la préparation d'un match", () => {
    expect(isNavItemActive(item("/preparations"), "/preparations")).toBe(true);
    expect(isNavItemActive(item("/preparations"), "/preparations/abc")).toBe(true);
    expect(isNavItemActive(item("/notes"), "/preparations/abc")).toBe(false);
  });

  it("active « Notes de match » sur la fiche d'un match", () => {
    expect(isNavItemActive(item("/notes"), "/matchs/abc")).toBe(true);
    expect(isNavItemActive(item("/notes"), "/matchs/nouveau")).toBe(true);
  });
});

describe("isAnyNavItemActive", () => {
  it("signale une page secondaire ou d'administration affichée", () => {
    expect(isAnyNavItemActive(SECONDARY_NAV, "/collegues")).toBe(true);
    expect(isAnyNavItemActive(ADMIN_NAV, "/admin/invitations")).toBe(true);
    expect(isAnyNavItemActive(SECONDARY_NAV, "/indemnites")).toBe(false);
  });
});

describe("structure", () => {
  it("garde au plus 4 onglets sur téléphone : 5 avec « Plus »", () => {
    expect(MOBILE_TAB_NAV.length).toBeLessThanOrEqual(4);
  });

  it("place « Préparation de match » entre les indemnités et les notes (barre latérale)", () => {
    expect(PRIMARY_NAV.map((entry) => entry.href)).toEqual([
      "/",
      "/a-venir",
      "/indemnites",
      "/preparations",
      "/notes",
    ]);
  });

  it("met « Préparation de match » en onglet et « Notes de match » en tête du menu « Plus »", () => {
    expect(MOBILE_TAB_NAV.at(-1)?.href).toBe("/preparations");
    expect(MOBILE_TAB_NAV.some((entry) => entry.href === "/notes")).toBe(false);
    expect(MOBILE_PANEL_NAV[0]?.href).toBe("/notes");
    expect(MOBILE_PANEL_NAV.slice(1)).toEqual(SECONDARY_NAV);
  });

  it("donne une icône à chaque onglet du téléphone, et à eux seuls", () => {
    expect(MOBILE_TAB_NAV.every((entry) => entry.icon !== undefined)).toBe(true);
    expect([...SECONDARY_NAV, ...ADMIN_NAV, ACCOUNT_NAV].some((e) => e.icon !== undefined)).toBe(
      false,
    );
  });

  it("n'a aucun lien en double", () => {
    const hrefs = [...PRIMARY_NAV, ...SECONDARY_NAV, ...ADMIN_NAV, ACCOUNT_NAV].map((e) => e.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});

describe("navItemBadgeCount", () => {
  it("porte les demandes d'accès en attente sur « Invitations » seulement", () => {
    expect(navItemBadgeCount(item("/admin/invitations"), 3)).toBe(3);
    expect(navItemBadgeCount(item("/admin/comptes"), 3)).toBe(0);
    expect(navItemBadgeCount(item("/"), 3)).toBe(0);
  });

  it("n'affiche rien sans demande (ni pour un nombre négatif)", () => {
    expect(navItemBadgeCount(item("/admin/invitations"), 0)).toBe(0);
    expect(navItemBadgeCount(item("/admin/invitations"), -1)).toBe(0);
  });
});

describe("pendingRequestsLabel", () => {
  it("accorde au singulier et au pluriel", () => {
    expect(pendingRequestsLabel(1)).toBe("1 demande d'accès en attente");
    expect(pendingRequestsLabel(4)).toBe("4 demandes d'accès en attente");
  });
});
