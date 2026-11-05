/**
 * Gabarit d'email commun (texte + HTML). Fonction pure, sans accès à l'environnement.
 * Imports relatifs avec extension .ts : utilisé aussi par scripts/email-test.mts.
 */
import { ValidationError } from "../../lib/errors.ts";

export type EmailContent = {
  title: string;
  paragraphs: readonly string[];
  /** Bouton d'action (lien à jeton, etc.). `fallback` introduit le lien en clair sous le bouton. */
  action?: { label: string; url: string; fallback: string };
  footer: string;
};

export type RenderedEmail = { text: string; html: string };

/** Échappe le texte inséré dans le HTML (contenu et attributs). */
function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** N'accepte que http(s) : jamais de `javascript:` ni `data:` dans un lien d'email. */
function toSafeHref(value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new ValidationError("URL d'action invalide.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new ValidationError("URL d'action invalide.");
  }
  return parsed.href;
}

export function renderEmail(content: EmailContent): RenderedEmail {
  const href = content.action === undefined ? undefined : toSafeHref(content.action.url);

  const textParts = [content.title, ...content.paragraphs];
  if (content.action !== undefined && href !== undefined) {
    textParts.push(`${content.action.label} :\n${href}`);
  }
  textParts.push(`-- \n${content.footer}`);
  const text = textParts.join("\n\n");

  const paragraphsHtml = content.paragraphs
    .map((paragraph) => `<p style="margin:0 0 16px;">${escapeHtml(paragraph)}</p>`)
    .join("\n");

  const actionHtml =
    content.action === undefined || href === undefined
      ? ""
      : `<p style="margin:24px 0;"><a href="${escapeHtml(href)}" rel="noopener noreferrer" style="display:inline-block;padding:12px 24px;background:#111827;color:#ffffff;text-decoration:none;border-radius:6px;">${escapeHtml(content.action.label)}</a></p>
<p style="margin:0 0 16px;font-size:14px;color:#4b5563;">${escapeHtml(content.action.fallback)}<br><span style="word-break:break-all;">${escapeHtml(href)}</span></p>`;

  const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(content.title)}</title>
</head>
<body style="margin:0;padding:24px;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:32px;background:#ffffff;border-radius:8px;color:#111827;line-height:1.5;">
<h1 style="margin:0 0 24px;font-size:20px;">${escapeHtml(content.title)}</h1>
${paragraphsHtml}
${actionHtml}
<p style="margin:24px 0 0;font-size:13px;color:#4b5563;">${escapeHtml(content.footer)}</p>
</div>
</body>
</html>`;

  return { text, html };
}
