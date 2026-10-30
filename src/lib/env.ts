import { z } from "zod";
import { ConfigError } from "@/lib/errors";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
  DATABASE_URL: z.url(),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET doit faire au moins 32 caractères"),
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