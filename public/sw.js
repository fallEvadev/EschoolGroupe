/*
 * Service worker d'E-School Groupe : rôle volontairement minimal.
 *
 * Il ne garde en mémoire QUE la page « Vous êtes hors ligne » (et sa feuille
 * de style). Aucune page connectée, aucune réponse de l'API, aucune donnée
 * du personnel n'est mise en cache : tout passe toujours par le réseau. Si le
 * réseau manque pendant qu'on ouvre une page, on affiche la page hors ligne.
 *
 * Pour changer ce fichier : augmenter VERSION afin que les téléphones
 * remplacent l'ancienne copie.
 */
const VERSION = "v1";
const CACHE = `eschool-hors-ligne-${VERSION}`;
const OFFLINE_URL = "/hors-ligne";

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const response = await fetch(OFFLINE_URL, { cache: "reload" });
      if (!response.ok) return;
      // On garde aussi les feuilles de style de la page, pour qu'elle reste lisible.
      const html = await response.clone().text();
      const styles = [
        ...html.matchAll(/href="(\/_next\/static\/[^"]+\.css)"/g),
      ].map((match) => match[1]);
      await cache.put(OFFLINE_URL, response);
      await Promise.all(
        styles.map((url) => cache.add(url).catch(() => undefined)),
      );
    })().catch(() => undefined),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Supprime les copies des anciennes versions.
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter(
            (key) => key.startsWith("eschool-hors-ligne-") && key !== CACHE,
          )
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  // Seulement l'ouverture d'une page : le reste (API, fichiers) va au réseau.
  if (request.mode !== "navigate") return;
  event.respondWith(
    fetch(request).catch(async () => {
      const cache = await caches.open(CACHE);
      return (
        (await cache.match(OFFLINE_URL)) ??
        new Response("Vous êtes hors ligne.", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        })
      );
    }),
  );
});

// Les fichiers de style de la page hors ligne sont servis depuis le cache.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.mode === "navigate" || url.origin !== self.location.origin)
    return;
  if (
    !url.pathname.startsWith("/_next/static/") ||
    !url.pathname.endsWith(".css")
  )
    return;
  event.respondWith(
    fetch(event.request).catch(async () => {
      const cache = await caches.open(CACHE);
      return (await cache.match(event.request)) ?? Response.error();
    }),
  );
});
