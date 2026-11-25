/**
 * Extensions de l'éditeur de texte riche (notes de match, préparations, axes d'amélioration),
 * partagées par l'éditeur (client) et la conversion Markdown (tests, serveur).
 *
 * Le texte est stocké en Markdown, dans les mêmes colonnes texte qu'avant : un texte saisi
 * avant l'éditeur s'ouvre tel quel, l'export reste lisible et la recherche continue de marcher.
 *
 * Syntaxe stockée :
 *  * gras `**a**`, italique `*a*`, souligné `<u>a</u>`, barré `~~a~~`, surligné `==a==` ;
 *  * tailles par paragraphe : `# ` (très grand), `## ` (grand), `### ` (moyen), normal, et
 *    `-# ` (petit, comme Discord) ;
 *  * listes à puces `- a`, numérotées `1. a`, de cases `- [ ] a` / `- [x] a` ;
 *  * citation `> a`, séparateur `---`.
 *
 * Volontairement absents : liens, images, code, tableaux (rien qui charge une ressource
 * extérieure ni qui demande un style en ligne, interdit par la CSP).
 */
import { Node, mergeAttributes } from "@tiptap/core";
import type { AnyExtension } from "@tiptap/core";
import { Highlight } from "@tiptap/extension-highlight";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { StarterKit } from "@tiptap/starter-kit";
import { fr } from "@/i18n/fr";

/** Niveaux de titre utilisés comme tailles de texte (1 = le plus grand). */
const HEADING_LEVELS = [1, 2, 3] as const;
export type HeadingLevel = (typeof HEADING_LEVELS)[number];

const SMALL_TEXT_PATTERN = /^-# +([^\n]*)(?:\n|$)/;

/** Paragraphe en petit texte : `-# texte` en Markdown. */
const SmallText = Node.create({
  name: "smallText",
  group: "block",
  content: "inline*",
  defining: true,

  parseHTML() {
    return [{ tag: "p[data-size=small]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["p", mergeAttributes(HTMLAttributes, { "data-size": "small" }), 0];
  },

  markdownTokenName: "smallText",

  markdownTokenizer: {
    name: "smallText",
    level: "block",
    start: (src: string) => src.indexOf("-# "),
    tokenize: (src, _tokens, lexer) => {
      const match = SMALL_TEXT_PATTERN.exec(src);
      if (match === null) {
        return undefined;
      }
      const text = match[1] ?? "";
      return { type: "smallText", raw: match[0], text, tokens: lexer.inlineTokens(text) };
    },
  },

  parseMarkdown: (token, helpers) =>
    helpers.createNode("smallText", undefined, helpers.parseInline(token.tokens ?? [])),

  renderMarkdown: (node, helpers) =>
    node.content === undefined || node.content.length === 0
      ? ""
      : `-# ${helpers.renderChildren(node.content)}`,
});

/** Extensions de l'éditeur, hors Markdown (ajouté par l'éditeur lui-même). */
export function richTextExtensions(): AnyExtension[] {
  return [
    StarterKit.configure({
      heading: { levels: [...HEADING_LEVELS] },
      code: false,
      codeBlock: false,
      link: false,
      // Les styles en ligne sont interdits par la CSP : pas de curseur de glisser-déposer.
      dropcursor: false,
    }),
    SmallText,
    Highlight,
    TaskList,
    TaskItem.configure({
      nested: true,
      // Libellé de la case pour les lecteurs d'écran (anglais par défaut).
      a11y: {
        checkboxLabel: (node, checked) =>
          (checked ? fr.richText.taskChecked : fr.richText.taskUnchecked).replace(
            "{text}",
            node.textContent || fr.richText.taskEmpty,
          ),
      },
    }),
  ];
}
