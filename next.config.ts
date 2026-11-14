import type { NextConfig } from "next";

// En-têtes de sécurité constants (§6.4, A05), posés sur TOUTES les réponses par `headers()`.
// `proxy.ts` n'ajoute que la CSP à nonce et la `Referrer-Policy` (qui varie selon le chemin) ;
// comme le middleware s'applique en dernier, ses en-têtes REMPLACENT ceux-ci sur les chemins
// qu'il traite (ex. `Referrer-Policy: no-referrer` sur les chemins à jeton l'emporte), sans
// doublon. Les chemins exclus du matcher de `proxy.ts` (statiques, `.webmanifest`, `icon.svg`,
// 404 de `/robots.txt`) n'obtenaient aucun en-tête : ils les reçoivent désormais ici.
const BASE_SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  // Production (docs/deploy.md) : `next build` produit un serveur autonome dans `.next/standalone`
  // (server.js + seulement les dépendances réellement utilisées). L'image Docker ne copie que ce
  // dossier, `.next/static` et `public` : image minimale, sans pnpm ni dépendances de dev (§6.7).
  output: "standalone",
  // L'en-tête `X-Powered-By: Next.js` divulgue la pile sans utilité : on le retire (§6.4, A05).
  poweredByHeader: false,
  // `next dev` seulement (sans effet sur le build de production) : depuis Next.js 16, le
  // serveur de développement refuse les ressources de dev (rechargement à chaud) aux pages
  // qui ne viennent pas de localhost. Ouverte depuis un téléphone à l'adresse du PC sur le
  // réseau local, la page ne s'hydrate jamais : plus aucun bouton client ne répond (menu
  // « Plus », sélection des paiements). On autorise les plages d'adresses privées courantes.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*"],
  headers() {
    return Promise.resolve([
      // Service worker (bloc 14) : `proxy.ts` ne s'exécute pas sur une URL avec un point, les
      // en-têtes sont donc posés ici. Jamais mis en cache, pour qu'une nouvelle version soit vue
      // dès la visite suivante ; CSP propre au script du worker (il ne charge rien d'autre).
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
      // En-têtes de sécurité de base sur tous les chemins (y compris les ressources statiques
      // que `proxy.ts` n'atteint pas). La CSP à nonce reste gérée par `proxy.ts`.
      { source: "/:path*", headers: BASE_SECURITY_HEADERS },
    ]);
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
