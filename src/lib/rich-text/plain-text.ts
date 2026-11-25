/**
 * Texte brut d'un texte riche stocké en Markdown (voir `extensions.ts`), pour les extraits
 * (liste des notes de match). Retire la mise en forme ligne par ligne, sans analyseur : un
 * extrait coupé au milieu d'une balise reste lisible. Pur et sans dépendance : testé à part.
 */

const LINE_RULES: readonly [RegExp, string][] = [
  // Cases à cocher, avant les puces (elles commencent aussi par « - »).
  [/^(\s*)[-*+] \[[xX]\] /, "$1☑ "],
  [/^(\s*)[-*+] \[ \] /, "$1☐ "],
  [/^(\s*)[-*+] /, "$1• "],
  [/^-# +/, ""],
  [/^#{1,6} +/, ""],
  [/^(?:> ?)+/, ""],
  [/^ {0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/, "—"],
];

const INLINE_RULES: readonly [RegExp, string][] = [
  [/<\/?u>/gi, ""],
  [/\*\*|__|~~|==/g, ""],
  // Italique : un astérisque ou un souligné collé au mot (pas « 3 * 4 »).
  [/(^|[^\\\w*])[*_](?=\S)/g, "$1"],
  [/(?<=[^\s\\*])[*_](?=$|[^\w*])/g, ""],
  // Espaces de fin de ligne d'un saut de ligne forcé.
  [/ {2,}$/, ""],
  // Caractères échappés (`\*` → `*`) et entités d'espace insécable.
  [/\\([\\`*_{}[\]()#+\-.!|~=<>])/g, "$1"],
  [/&nbsp;/g, " "],
];

export function richTextToPlain(markdown: string): string {
  return markdown
    .split("\n")
    .map((line) => {
      let text = line;
      for (const [pattern, replacement] of LINE_RULES) {
        text = text.replace(pattern, replacement);
      }
      for (const [pattern, replacement] of INLINE_RULES) {
        text = text.replace(pattern, replacement);
      }
      return text;
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
}
