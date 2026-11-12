/**
 * Validation de l'environnement au démarrage (fail fast), isolée dans un module node-only.
 *
 * `instrumentation.ts` est compilé pour les runtimes Edge ET Node ; `process.exit` n'existe
 * pas côté Edge. On place donc le code node-only ici, importé dynamiquement sous le garde
 * `NEXT_RUNTIME === "nodejs"`, pour qu'il n'entre pas dans le graphe Edge (motif Next.js).
 */
import { getEnv } from "@/lib/env";

/** Valide l'environnement ; une config invalide empêche le serveur de démarrer. */
export function validateEnvOrExit(): void {
  try {
    getEnv();
  } catch (error) {
    // Config invalide : on refuse de démarrer (crash visible, redémarrage/healthcheck Docker)
    // plutôt que de répondre 500 à chaque requête (env jamais peuplé). Le message de `getEnv`
    // ne nomme que les variables fautives, jamais leurs valeurs (voir `env.ts`).
    console.error(
      error instanceof Error ? error.message : "Configuration d'environnement invalide.",
    );
    // Pendant `next build`, l'env de production n'est pas forcément fourni : on ne tue pas le
    // build. La validation redeviendra fatale au démarrage réel du serveur.
    if (process.env.NEXT_PHASE === "phase-production-build") {
      return;
    }
    process.exit(1);
  }
}
