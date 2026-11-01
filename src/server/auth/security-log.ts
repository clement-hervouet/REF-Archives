/**
 * Journal des événements de sécurité : logique pure (testable sans base).
 * Le branchement sur la vraie base est dans `record-security-event.ts`.
 */
import { createHmac } from "node:crypto";
import type { SecurityEvent, SecurityEventType } from "../db/security-events";
import { UNKNOWN_IP } from "./client-ip";

/**
 * Empreinte d'une IP pour le journal : HMAC-SHA256 clé par un secret de l'application.
 * Permet de reconnaître une même IP sans pouvoir la retrouver (un SHA-256 simple d'une
 * IPv4 se casse par énumération de l'espace d'adresses).
 */
export function hashIpForLog(ip: string, secret: string): string {
  return createHmac("sha256", secret).update(ip, "utf8").digest("hex");
}

export type SecurityEventInput = {
  type: SecurityEventType;
  userId?: string | null;
  /** IP du client. Absente ou inconnue : rien n'est stocké. */
  ip?: string;
};

export type SecurityLogDeps = {
  insert: (event: SecurityEvent) => Promise<void>;
  secret: () => string;
  /** Reçoit uniquement le NOM de l'erreur : son message pourrait contenir des valeurs. */
  onError: (errorName: string) => void;
};

/**
 * Fabrique la fonction d'enregistrement. Elle ne lève jamais d'erreur : un journal
 * indisponible ne doit pas empêcher quelqu'un de se connecter.
 */
export function createSecurityEventRecorder(
  deps: SecurityLogDeps,
): (input: SecurityEventInput) => Promise<void> {
  return async (input) => {
    try {
      const ip = input.ip;
      await deps.insert({
        type: input.type,
        userId: input.userId ?? null,
        ipHash: ip === undefined || ip === UNKNOWN_IP ? null : hashIpForLog(ip, deps.secret()),
      });
    } catch (error: unknown) {
      deps.onError(error instanceof Error ? error.name : "UnknownError");
    }
  };
}