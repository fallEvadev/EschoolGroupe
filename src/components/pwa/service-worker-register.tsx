"use client";

import { useEffect } from "react";

/**
 * Enregistre le service worker (`public/sw.js`, page hors ligne seulement).
 * Uniquement en production : en développement, un service worker gênerait les
 * rechargements. Un échec n'a aucune conséquence pour l'utilisateur.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);
  return null;
}
