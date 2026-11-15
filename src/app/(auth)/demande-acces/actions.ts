"use server";

import { headers } from "next/headers";
import { after } from "next/server";
import type { ProfileIssue } from "@/lib/schemas/profile";
import { createSubmitAccessRequestDeps } from "@/server/auth/access-request-deps";
import { submitAccessRequest } from "@/server/auth/access-requests";
import { getClientIp } from "@/server/auth/client-ip";
import { recordSecurityEvent } from "@/server/auth/record-security-event";

/** Saisies renvoyées dans tous les états : les champs ne sont pas vidés après une erreur. */
type Values = { email: string; firstname: string; lastname: string };

export type AccessRequestFormState =
  | { status: "idle"; values: Values }
  | { status: "invalid"; values: Values; emailInvalid: boolean; profileIssues: ProfileIssue[] }
  | { status: "rate_limited"; values: Values; retryAfterMinutes: number }
  // Identique que l'adresse ait déjà un compte, une demande en attente ou rien (§6.1).
  | { status: "requested"; values: Values; email: string };

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

/**
 * Envoie une demande d'accès (§15.4.4). Formulaire public : la réponse ne dit jamais si
 * l'adresse a déjà un compte ou une demande en attente.
 */
export async function submitAccessRequestAction(
  _previous: AccessRequestFormState,
  formData: FormData,
): Promise<AccessRequestFormState> {
  const values: Values = {
    email: text(formData, "email"),
    firstname: text(formData, "firstname"),
    lastname: text(formData, "lastname"),
  };
  const ip = getClientIp(await headers());
  const result = await submitAccessRequest(createSubmitAccessRequestDeps(), { ...values, ip });

  switch (result.status) {
    case "invalid":
      return {
        status: "invalid",
        values,
        emailInvalid: result.emailInvalid,
        profileIssues: result.profileIssues,
      };
    case "rate_limited":
      return {
        status: "rate_limited",
        values,
        retryAfterMinutes: Math.max(1, Math.ceil(result.retryAfterSeconds / 60)),
      };
    case "requested":
      if (result.created) {
        // Journal sans email ni nom (§6.1), écrit après la réponse : même durée de réponse
        // que la demande soit créée ou ignorée.
        after(async () => {
          await recordSecurityEvent({ type: "access_requested", ip });
        });
      }
      return { status: "requested", values, email: result.email };
  }
}
