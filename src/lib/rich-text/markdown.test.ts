import { MarkdownManager } from "@tiptap/markdown";
import { describe, expect, it } from "vitest";
import { richTextExtensions } from "./extensions";

// Mêmes réglages que l'éditeur (`rich-text-field.tsx`).
const manager = new MarkdownManager({
  extensions: richTextExtensions(),
  markedOptions: { breaks: true },
});

function roundTrip(markdown: string): string {
  return manager.serialize(manager.parse(markdown));
}

describe("aller-retour Markdown de l'éditeur", () => {
  it.each([
    ["gras, italique, souligné, barré, surligné", "**a** *b* <u>c</u> ~~d~~ ==e=="],
    ["tailles", "# Très grand\n\n## Grand\n\n### Moyen\n\nNormal\n\n-# Petit"],
    ["petit texte mis en forme", "-# petit **gras**"],
    ["liste à puces", "- un\n- deux"],
    ["liste numérotée", "1. un\n2. deux"],
    ["cases à cocher", "- [ ] à faire\n- [x] fait"],
    ["cases imbriquées", "- [ ] a\n  - [x] b"],
    ["citation et séparateur", "> cité\n\n---\n\nsuite"],
  ])("%s", (_label, markdown) => {
    expect(roundTrip(markdown)).toBe(markdown);
  });

  it("garde les retours à la ligne d'un texte saisi avant l'éditeur", () => {
    const doc = manager.parse("Le 8 provoque.\nMeneur rapide.");
    expect(doc.content?.[0]?.content?.map((node) => node.type)).toEqual([
      "text",
      "hardBreak",
      "text",
    ]);
    expect(roundTrip("Le 8 provoque.\nMeneur rapide.")).toBe("Le 8 provoque.  \nMeneur rapide.");
  });

  it("lit le petit texte comme un bloc à part", () => {
    expect(manager.parse("-# petit").content?.[0]?.type).toBe("smallText");
  });

  it("ne crée aucun nœud pour une balise HTML inconnue (au plus du texte)", () => {
    type JsonNode = { type?: string; content?: JsonNode[] };
    const types = new Set<string>();
    const walk = (node: JsonNode): void => {
      if (node.type !== undefined) types.add(node.type);
      for (const child of node.content ?? []) walk(child);
    };
    walk(manager.parse('<img src="x" onerror="alert(1)"><script>x</script>'));
    expect([...types].every((type) => ["doc", "paragraph", "text"].includes(type))).toBe(true);
  });
});
