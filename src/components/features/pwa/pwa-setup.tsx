"use client";

/**
 * Mise en place de l'application installable (bloc 14), montée par le layout racine sur
 * toutes les pages : enregistre le service worker (page « hors ligne ») et capture la
 * proposition d'installation du navigateur pour la section des paramètres.
 * N'affiche rien.
 */
import { useEffect } from "react";
import { SERVICE_WORKER_PATH } from "@/lib/pwa";
import { startInstallPromptCapture } from "./install-prompt";

export function PwaSetup() {
  useEffect(() => {
    const stopCapture = startInstallPromptCapture();
    // Absent en HTTP hors localhost (contexte non sécurisé) et dans certains navigateurs.
    if ("serviceWorker" in navigator) {
      // `updateViaCache: "none"` : le navigateur vérifie toujours sw.js auprès du serveur.
      navigator.serviceWorker
        .register(SERVICE_WORKER_PATH, { scope: "/", updateViaCache: "none" })
        .catch(() => {
          // Sans service worker, l'application marche normalement, sans page hors ligne.
        });
    }
    return stopCapture;
  }, []);

  return null;
}
