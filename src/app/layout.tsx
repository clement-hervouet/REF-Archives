import type { Metadata } from "next";
import localFont from "next/font/local";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { fr } from "@/i18n/fr";
import { THEME_COOKIE, themeAttributeFromCookie } from "@/lib/theme";
import "./globals.css";

// Une seule famille, Archivo variable en graisse et en largeur (licence OFL, voir
// fonts/OFL-Archivo.txt) : la largeur resserrée sert aux titres (globals.css). Fichier
// versionné dans le dépôt : le build ne dépend d'aucun service extérieur, et la police est
// servie par l'application elle-même (`font-src 'self'` dans la CSP). Sous-ensemble latin :
// français complet (accents, œ, €).
const archivo = localFont({
  src: "./fonts/archivo-latin-wdth-normal.woff2",
  variable: "--font-archivo",
  weight: "100 900",
  style: "normal",
  display: "swap",
  declarations: [{ prop: "font-stretch", value: "62% 125%" }],
});

export const metadata: Metadata = {
  title: fr.app.name,
  description: fr.app.tagline,
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Thème choisi dans les paramètres (cookie) ; sans choix, le CSS suit le système.
  const theme = themeAttributeFromCookie((await cookies()).get(THEME_COOKIE)?.value);

  return (
    <html lang="fr" data-theme={theme} className={`${archivo.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
