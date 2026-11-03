import { describe, expect, it } from "vitest";
import { ValidationError } from "../../lib/errors";
import { renderEmail } from "./layout";

const base = {
  title: "Mon titre",
  paragraphs: ["Premier paragraphe", "Second paragraphe"],
  footer: "Pied de page",
};
const action = { label: "Cliquer", url: "https://example.com/a?x=1&y=2", fallback: "Copiez ce lien :" };

describe("renderEmail", () => {
  it("produit un texte avec titre, paragraphes et pied de page", () => {
    const { text } = renderEmail(base);
    expect(text).toContain("Mon titre");
    expect(text).toContain("Premier paragraphe");
    expect(text).toContain("Second paragraphe");
    expect(text).toContain("Pied de page");
  });

  it("inclut le lien d'action en clair dans le texte et dans le HTML", () => {
    const { text, html } = renderEmail({ ...base, action });
    expect(text).toContain("https://example.com/a?x=1&y=2");
    expect(html).toContain('href="https://example.com/a?x=1&amp;y=2"');
    expect(html).toContain("Cliquer");
    expect(html).toContain("Copiez ce lien :");
  });

  it("n'ajoute aucun lien sans action", () => {
    const { html } = renderEmail(base);
    expect(html).not.toContain("<a ");
  });

  it("échappe le HTML dans les contenus", () => {
    const { html } = renderEmail({
      ...base,
      title: "<script>alert(1)</script>",
      paragraphs: ["Tom & Jerry \"l'ami\""],
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("Tom &amp; Jerry &quot;l&#39;ami&quot;");
  });

  it("refuse une URL qui n'est pas http(s)", () => {
    expect(() =>
      renderEmail({ ...base, action: { ...action, url: "javascript:alert(1)" } }),
    ).toThrow(ValidationError);
    expect(() => renderEmail({ ...base, action: { ...action, url: "data:text/html,x" } })).toThrow(
      ValidationError,
    );
  });

  it("refuse une URL illisible", () => {
    expect(() => renderEmail({ ...base, action: { ...action, url: "pas une url" } })).toThrow(
      ValidationError,
    );
  });
});