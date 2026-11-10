/*
 * Service worker de REF-Archives (bloc 14), écrit à la main, sans bibliothèque.
 *
 * Un seul rôle : quand une page ne peut pas être chargée faute de réseau, afficher la page
 * « hors ligne » à la place de l'erreur du navigateur.
 *
 * Il ne met en cache QUE cette page et ses deux ressources (feuille de styles, icône), qui
 * ne contiennent aucune donnée personnelle. Toute autre requête part au réseau telle quelle :
 * aucune page, aucune réponse d'API ni aucun fichier de l'utilisateur n'est copié sur
 * l'appareil. Les envois de formulaires (POST) ne sont jamais interceptés.
 *
 * Nouvelle version de la page hors ligne ou de ses ressources : incrémenter CACHE_VERSION
 * (l'ancien cache est effacé à l'activation). Chemins repris de src/lib/pwa.ts.
 */

const CACHE_VERSION = 1;
const CACHE_PREFIX = "ref-archives-offline-";
const CACHE_NAME = `${CACHE_PREFIX}v${CACHE_VERSION}`;
const OFFLINE_URL = "/hors-ligne";
const OFFLINE_ASSETS = ["/offline.css", "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // `cache: "reload"` : on enregistre la version du serveur, pas celle du cache HTTP.
      await cache.addAll(
        [OFFLINE_URL, ...OFFLINE_ASSETS].map((url) => new Request(url, { cache: "reload" })),
      );
      // Rien à préserver d'une version à l'autre : la nouvelle prend la main tout de suite.
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
          .map((name) => caches.delete(name)),
      );
      // Le navigateur lance la requête de la page pendant que le service worker démarre :
      // l'interception ne ralentit pas la navigation.
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") {
    return;
  }
  if (request.mode === "navigate") {
    event.respondWith(navigate(event));
    return;
  }
  // Ressources de la page hors ligne : réseau d'abord (version à jour), cache sans réseau.
  const url = new URL(request.url);
  if (url.origin === self.location.origin && OFFLINE_ASSETS.includes(url.pathname)) {
    event.respondWith(fetch(request).catch(() => fromCache(request)));
  }
  // Tout le reste : pas d'appel à respondWith, le navigateur fait la requête lui-même.
});

/** Navigation : toujours le réseau ; la page hors ligne seulement si le réseau échoue. */
async function navigate(event) {
  try {
    const preloaded = await event.preloadResponse;
    if (preloaded) {
      return preloaded;
    }
    return await fetch(event.request);
  } catch {
    return fromCache(OFFLINE_URL);
  }
}

async function fromCache(request) {
  const cached = await caches.match(request, { cacheName: CACHE_NAME });
  return cached ?? Response.error();
}
