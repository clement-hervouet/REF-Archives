/**
 * Page « hors ligne » (bloc 14) : HTML complet, construit par une fonction pure.
 *
 * Le service worker la met en cache et la montre quand une page ne peut pas être chargée
 * faute de réseau. Elle doit donc tenir seule : aucun script (ceux de Next.js ne sont pas en
 * cache), une seule feuille de styles (`public/offline.css`, mise en cache avec elle) et
 * l'icône 192 px. Elle ne contient aucune donnée personnelle.
 */
import { fr } from "@/i18n/fr";
import { OFFLINE_STYLESHEET_PATH, PWA_ICONS } from "@/lib/pwa";

/** Échappe le texte inséré dans le HTML (contenu et attributs). */
export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function renderOfflinePage(): string {
  const t = fr.pwa.offline;
  const appName = escapeHtml(fr.app.name);
  // `href=""` recharge l'adresse demandée : le service worker sert cette page à la place de
  // la page voulue, sans changer l'URL. Pas besoin de script pour « Réessayer ».
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="robots" content="noindex">
<title>${escapeHtml(t.title)} · ${appName}</title>
<link rel="stylesheet" href="${OFFLINE_STYLESHEET_PATH}">
</head>
<body>
<main>
<img src="${PWA_ICONS.small}" alt="" width="64" height="64">
<p class="brand">${appName}</p>
<h1>${escapeHtml(t.heading)}</h1>
<p>${escapeHtml(t.body)}</p>
<p class="hint">${escapeHtml(t.hint)}</p>
<a class="button" href="">${escapeHtml(t.retry)}</a>
</main>
</body>
</html>
`;
}
