/**
 * Proposition d'installation du navigateur (bloc 14) : petit magasin partagé.
 *
 * Chrome, Edge et Samsung Internet envoient `beforeinstallprompt` une seule fois, souvent
 * bien avant qu'on ouvre les paramètres. `PwaSetup` (layout racine, toutes les pages) le
 * capture dès le chargement ; la section « Installer l'application » le lit ensuite avec
 * `useSyncExternalStore`. Safari et Firefox n'envoient jamais cet événement.
 */

/** Événement non standard, absent des types du DOM : seules les parties utilisées. */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<unknown>;
  userChoice: Promise<{ outcome: string }>;
};

export type InstallState = {
  /** Proposition gardée de côté, utilisable une seule fois. */
  prompt: BeforeInstallPromptEvent | null;
  /** Vrai après `appinstalled` ou une installation acceptée pendant cette visite. */
  installed: boolean;
};

export type InstallOutcome = "accepted" | "dismissed" | "unavailable";

const SERVER_STATE: InstallState = { prompt: null, installed: false };

let state: InstallState = SERVER_STATE;
const listeners = new Set<() => void>();

function setState(next: InstallState): void {
  state = next;
  for (const listener of listeners) {
    listener();
  }
}

function isBeforeInstallPromptEvent(event: Event): event is BeforeInstallPromptEvent {
  return "prompt" in event && typeof event.prompt === "function" && "userChoice" in event;
}

/** Écoute la proposition et l'installation ; renvoie la fonction qui arrête l'écoute. */
export function startInstallPromptCapture(): () => void {
  function handlePrompt(event: Event): void {
    if (!isBeforeInstallPromptEvent(event)) {
      return;
    }
    // Pas de mini-barre automatique (Chrome Android) : l'installation se propose depuis les
    // paramètres. Le menu du navigateur garde son entrée « Installer l'application ».
    event.preventDefault();
    setState({ prompt: event, installed: false });
  }
  function handleInstalled(): void {
    setState({ prompt: null, installed: true });
  }
  window.addEventListener("beforeinstallprompt", handlePrompt);
  window.addEventListener("appinstalled", handleInstalled);
  return () => {
    window.removeEventListener("beforeinstallprompt", handlePrompt);
    window.removeEventListener("appinstalled", handleInstalled);
  };
}

export function subscribeInstallState(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getInstallState(): InstallState {
  return state;
}

/** Rendu serveur et hydratation : aucune proposition. */
export function getServerInstallState(): InstallState {
  return SERVER_STATE;
}

/** Ouvre la fenêtre d'installation du navigateur et renvoie le choix de la personne. */
export async function promptInstall(): Promise<InstallOutcome> {
  const event = state.prompt;
  if (event === null) {
    return "unavailable";
  }
  // La proposition ne sert qu'une fois : on l'oublie avant d'ouvrir la fenêtre.
  setState({ prompt: null, installed: false });
  try {
    await event.prompt();
    const choice = await event.userChoice;
    if (choice.outcome === "accepted") {
      setState({ prompt: null, installed: true });
      return "accepted";
    }
    return "dismissed";
  } catch {
    return "unavailable";
  }
}
