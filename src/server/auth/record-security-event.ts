/**
 * Enregistre un événement de sécurité dans la base. Ne lève jamais d'erreur
 * (voir `security-log.ts`).
 */
import { getEnv } from "@/lib/env";
import { getDb } from "../db/pool";
import { insertSecurityEvent } from "../db/security-events";
import { createSecurityEventRecorder } from "./security-log";

export const recordSecurityEvent = createSecurityEventRecorder({
  insert: (event) => insertSecurityEvent(getDb(), event),
  secret: () => getEnv().AUTH_SECRET,
  onError: (errorName) => {
    console.error(`[journal de sécurité] écriture impossible (${errorName})`);
  },
});