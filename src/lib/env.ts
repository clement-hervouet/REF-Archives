import { z } from "zod";
import { ConfigError } from "@/lib/errors";

/** Une variable optionnelle laissée vide (`SMTP_USER=`) est traitée comme absente. */
const optionalString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional(),
);

/** Secret long et aléatoire ; laissé vide, la fonction qu'il protège est désactivée. */
const optionalSecret = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(32, "doit faire au moins 32 caractères").optional(),
);

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]),
    DATABASE_URL: z.url(),
    AUTH_SECRET: z.string().min(32, "AUTH_SECRET doit faire au moins 32 caractères"),

    // URL publique de l'app : base des liens envoyés par email (jamais déduite de l'en-tête Host).
    APP_URL: z.url({ protocol: /^https?$/ }).transform((url) => url.replace(/\/+$/, "")),

    // SMTP (CLAUDE.md §3.1, §9) : relais configurable, aucun fournisseur imposé.
    SMTP_HOST: z.string().min(1),
    SMTP_PORT: z.coerce.number().int().min(1).max(65535),
    // true = TLS implicite (port 465) ; false = STARTTLS ou relais local.
    SMTP_SECURE: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    SMTP_USER: optionalString,
    SMTP_PASSWORD: optionalString,
    EMAIL_FROM: z
      .string()
      .min(3)
      .max(254)
      .regex(/^[^\r\n]+@[^\r\n]+$/, "doit contenir une adresse email et aucun saut de ligne"),

    // Secret du job planifié des rappels (route /api/cron/reminders). Absent = rappels désactivés.
    CRON_SECRET: optionalSecret,
  })
  .refine((env) => env.SMTP_USER === undefined || env.SMTP_PASSWORD !== undefined, {
    message: "obligatoire quand SMTP_USER est défini",
    path: ["SMTP_PASSWORD"],
  })
  .refine((env) => env.SMTP_PASSWORD === undefined || env.SMTP_USER !== undefined, {
    message: "obligatoire quand SMTP_PASSWORD est défini",
    path: ["SMTP_USER"],
  })
  .refine((env) => env.NODE_ENV !== "production" || env.APP_URL.startsWith("https://"), {
    message: "doit commencer par https:// en production",
    path: ["APP_URL"],
  });

export type Env = z.infer<typeof EnvSchema>;

/** Valide une source de variables. Séparée de process.env pour être testable. */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = EnvSchema.safeParse(source);
  if (!result.success) {
    // On liste les NOMS des variables fautives et la règle violée, jamais leurs valeurs (secrets).
    const details = Object.entries(z.flattenError(result.error).fieldErrors)
      .map(([name, messages]) => `${name} (${messages.join(" ; ")})`)
      .join(", ");
    throw new ConfigError(`Variables d'environnement invalides : ${details}`);
  }
  return result.data;
}

let cached: Env | undefined;

/** Retourne l'environnement validé (mémoïsé). À n'utiliser que côté serveur. */
export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}