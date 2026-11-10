import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `next dev` seulement (sans effet sur le build de production) : depuis Next.js 16, le
  // serveur de développement refuse les ressources de dev (rechargement à chaud) aux pages
  // qui ne viennent pas de localhost. Ouverte depuis un téléphone à l'adresse du PC sur le
  // réseau local, la page ne s'hydrate jamais : plus aucun bouton client ne répond (menu
  // « Plus », sélection des paiements). On autorise les plages d'adresses privées courantes.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*"],
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
