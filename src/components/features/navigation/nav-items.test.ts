import { describe, expect, it } from "vitest";
import {
  ACCOUNT_NAV,
  ADMIN_NAV,
  PRIMARY_NAV,
  SECONDARY_NAV,
  isAnyNavItemActive,
  isNavItemActive,
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
  it("garde au plus 4 pages principales : 5 onglets avec « Plus » sur téléphone", () => {
    expect(PRIMARY_NAV.length).toBeLessThanOrEqual(4);
  });

  it("donne une icône à chaque onglet du téléphone, et à eux seuls", () => {
    expect(PRIMARY_NAV.every((entry) => entry.icon !== undefined)).toBe(true);
    expect([...SECONDARY_NAV, ...ADMIN_NAV, ACCOUNT_NAV].some((e) => e.icon !== undefined)).toBe(
      false,
    );
  });

  it("n'a aucun lien en double", () => {
    const hrefs = [...PRIMARY_NAV, ...SECONDARY_NAV, ...ADMIN_NAV, ACCOUNT_NAV].map((e) => e.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});
