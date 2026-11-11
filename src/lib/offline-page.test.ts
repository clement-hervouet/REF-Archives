import { describe, expect, it } from "vitest";
import { fr } from "@/i18n/fr";
import { escapeHtml, renderOfflinePage } from "./offline-page";

describe("escapeHtml", () => {
  it("échappe les caractères spéciaux du HTML, apostrophes et guillemets compris", () => {
    expect(escapeHtml(`<a href="x">L'été & co</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;L&#39;été &amp; co&lt;/a&gt;",
    );
  });

  it("laisse un texte ordinaire intact", () => {
    expect(escapeHtml("Pas de connexion")).toBe("Pas de connexion");
  });
});

describe("renderOfflinePage", () => {
  const html = renderOfflinePage();

  it("est un document complet en français", () => {
    expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
    expect(html).toContain('<html lang="fr">');
    expect(html).toContain('<meta charset="utf-8">');
    expect(html).toContain('<meta name="viewport" content="width=device-width, initial-scale=1">');
  });

  it("affiche les textes de fr.pwa.offline, échappés", () => {
    expect(html).toContain(`<h1>${escapeHtml(fr.pwa.offline.heading)}</h1>`);
    expect(html).toContain(escapeHtml(fr.pwa.offline.body));
    expect(html).toContain(escapeHtml(fr.pwa.offline.retry));
    // Les textes contiennent des apostrophes : aucune ne doit rester brute dans le HTML.
    expect(html).not.toContain("'");
  });

  it("ne charge que la feuille de styles et l'icône mises en cache", () => {
    expect(html).toContain('<link rel="stylesheet" href="/offline.css">');
    expect(html).toContain('<img src="/icons/icon-192.png" alt=""');
    expect(html.match(/(?:href|src)="([^"]*)"/g)).toEqual([
      'href="/offline.css"',
      'src="/icons/icon-192.png"',
      'href=""',
    ]);
  });

  it("ne contient aucun script ni style en ligne (CSP stricte)", () => {
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<style");
    expect(html).not.toContain("style=");
    expect(html).not.toMatch(/\son[a-z]+=/);
  });

  it("n'est pas indexée par les moteurs de recherche", () => {
    expect(html).toContain('<meta name="robots" content="noindex">');
  });
});
