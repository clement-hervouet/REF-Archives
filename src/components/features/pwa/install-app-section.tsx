"use client";

/**
 * Contenu de la section « Installer l'application » de /parametres (bloc 14c).
 *
 * Selon l'appareil : déjà installée, bouton quand le navigateur propose l'installation
 * (Chrome, Edge, Samsung Internet), mode d'emploi sur iPhone et iPad, sinon renvoi vers le
 * menu du navigateur. Tout dépend du navigateur : rien n'est rendu côté serveur (la place
 * est réservée pour éviter un saut de mise en page à l'hydratation).
 */
import { useState, useSyncExternalStore } from "react";
import { SUBMIT_BUTTON_CLASS } from "@/components/features/scales/form-parts";
import { fr } from "@/i18n/fr";
import { type InstallPlatform, detectInstallPlatform } from "@/lib/pwa";
import {
  getInstallState,
  getServerInstallState,
  promptInstall,
  subscribeInstallState,
} from "./install-prompt";

const t = fr.pwa.install;

const STANDALONE_QUERY = "(display-mode: standalone)";

function subscribeDisplayMode(onChange: () => void): () => void {
  const query = window.matchMedia(STANDALONE_QUERY);
  query.addEventListener("change", onChange);
  return () => {
    query.removeEventListener("change", onChange);
  };
}

/** Safari sur iPhone signale l'application ouverte depuis l'écran d'accueil à sa façon. */
function isIosStandalone(): boolean {
  return "standalone" in navigator && navigator.standalone === true;
}

function readPlatform(): InstallPlatform {
  return detectInstallPlatform({
    standalone: window.matchMedia(STANDALONE_QUERY).matches || isIosStandalone(),
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints,
  });
}

function readServerPlatform(): InstallPlatform | null {
  return null;
}

function StatusMessage({ children }: { children: string }) {
  return (
    <p role="status" className="border-l-4 border-success pl-3">
      {children}
    </p>
  );
}

function IosSteps() {
  return (
    <div className="flex flex-col gap-2">
      <p>{t.ios.intro}</p>
      <ol className="flex list-decimal flex-col gap-1 pl-6">
        {t.ios.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </div>
  );
}

export function InstallAppSection() {
  const platform = useSyncExternalStore(subscribeDisplayMode, readPlatform, readServerPlatform);
  const install = useSyncExternalStore(
    subscribeInstallState,
    getInstallState,
    getServerInstallState,
  );
  const [pending, setPending] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  async function handleInstall(): Promise<void> {
    setPending(true);
    const outcome = await promptInstall();
    setPending(false);
    setDismissed(outcome === "dismissed");
  }

  if (platform === null) {
    return <div className="min-h-11" aria-hidden="true" />;
  }
  if (platform === "standalone") {
    return <StatusMessage>{t.standalone}</StatusMessage>;
  }
  if (install.installed) {
    return <StatusMessage>{t.installed}</StatusMessage>;
  }
  if (install.prompt !== null) {
    return (
      <div className="flex flex-col gap-2">
        <button
          type="button"
          className={SUBMIT_BUTTON_CLASS}
          disabled={pending}
          aria-describedby="settings-install-hint"
          onClick={() => {
            void handleInstall();
          }}
        >
          {t.button}
        </button>
        <p id="settings-install-hint" className="text-sm text-muted-foreground">
          {t.buttonHint}
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {dismissed && <p role="status">{t.dismissed}</p>}
      {platform === "ios" ? <IosSteps /> : <p>{t.browserMenu}</p>}
    </div>
  );
}
