import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `next dev` seulement (sans effet sur le build de production) : depuis Next.js 16, le
  // serveur de développement refuse les ressources de dev (rechargement à chaud) aux pages
  // qui ne viennent pas de localhost. Ouverte depuis un téléphone à l'adresse du PC sur le
  // réseau local, la page ne s'hydrate jamais : plus aucun bouton client ne répond (menu
  // « Plus », sélection des paiements). On autorise les plages d'adresses privées courantes.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*"],
  // Service worker (bloc 14) : `proxy.ts` ne s'exécute pas sur une URL avec un point, les
  // en-têtes sont donc posés ici. Jamais mis en cache, pour qu'une nouvelle version soit vue
  // dès la visite suivante ; CSP propre au script du worker (il ne charge rien d'autre).
  headers() {
    return Promise.resolve([
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
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
