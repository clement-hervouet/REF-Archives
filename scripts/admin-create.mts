/**
 * Crée un compte administrateur directement en base (amorçage : personne ne
 * peut encore inviter). Usage : `pnpm admin:create <email>`.
 * Le mot de passe est saisi en mode masqué, jamais passé en argument ni affiché.
 */
import pg from "pg";
import { z } from "zod";
import { emailSchema, passwordSchema } from "../src/lib/schemas/auth.ts";
import { hashPassword } from "../src/server/auth/password.ts";
import { EmailAlreadyUsedError, createUser } from "../src/server/db/users.ts";
import type { Queryable } from "../src/server/db/users.ts";

const envSchema = z.object({ DATABASE_URL: z.url() });

// Codes d'erreur des schémas → messages pour le terminal (script de dev, hors i18n de l'app).
const MESSAGES: Record<string, string> = {
  "email.invalid": "L'email n'est pas valide.",
  "email.too_long": "L'email est trop long (255 caractères maximum).",
  "password.too_short": "Le mot de passe doit contenir au moins 12 caractères.",
  "password.too_long": "Le mot de passe est trop long (128 caractères maximum).",
  "password.too_common": "Ce mot de passe est trop courant.",
  "password.invalid": "Le mot de passe n'est pas valide.",
};

function describeIssues(issues: { message: string }[]): string {
  return issues.map((issue) => MESSAGES[issue.message] ?? issue.message).join(" ");
}

/** Lit une ligne au clavier sans l'afficher. Nécessite un vrai terminal (TTY). */
function readHidden(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const { stdin, stdout } = process;
    let value = "";

    function cleanup(): void {
      stdin.off("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
    }

    function onData(chunk: Buffer | string): void {
      const text = typeof chunk === "string" ? chunk : chunk.toString("utf8");
      for (const char of text) {
        if (char === "\u0003") {
          // Ctrl+C : le mode brut désactive le signal habituel, on le gère ici.
          cleanup();
          stdout.write("\n");
          reject(new Error("Opération annulée."));
          return;
        }
        if (char === "\r" || char === "\n") {
          cleanup();
          stdout.write("\n");
          resolve(value);
          return;
        }
        if (char === "\u007f" || char === "\b") {
          value = value.slice(0, -1);
        } else if (char >= " ") {
          value += char;
        }
      }
    }

    stdout.write(prompt);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on("data", onData);
  });
}

async function withClient(
  databaseUrl: string,
  action: (client: pg.Client) => Promise<void>,
): Promise<void> {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await action(client);
  } finally {
    await client.end();
  }
}

async function main(): Promise<void> {
  const env = envSchema.safeParse(process.env);
  if (!env.success) {
    // On ne nomme que la variable, jamais sa valeur (elle contient le mot de passe de la base).
    console.error("DATABASE_URL est absente ou invalide (voir .env.example).");
    process.exitCode = 1;
    return;
  }

  const email = emailSchema.safeParse(process.argv[2]);
  if (!email.success) {
    console.error("Usage : pnpm admin:create <email>");
    process.exitCode = 1;
    return;
  }

  if (!process.stdin.isTTY) {
    console.error("Ce script demande une saisie masquée : lance-le dans un terminal interactif.");
    process.exitCode = 1;
    return;
  }

  const password = await readHidden("Mot de passe : ");
  const confirmation = await readHidden("Confirmation : ");
  if (password !== confirmation) {
    console.error("Les deux saisies ne correspondent pas.");
    process.exitCode = 1;
    return;
  }

  const validPassword = passwordSchema.safeParse(password);
  if (!validPassword.success) {
    console.error(describeIssues(validPassword.error.issues));
    process.exitCode = 1;
    return;
  }

  const passwordHash = await hashPassword(validPassword.data);

  try {
    await withClient(env.data.DATABASE_URL, async (client) => {
      // Adaptateur vers la forme minimale attendue par `createUser`.
      const db: Queryable = {
        query: (text, values) => client.query<Record<string, unknown>>(text, values),
      };
      const user = await createUser(db, { email: email.data, passwordHash, role: "admin" });
      console.log(`Compte admin créé : ${user.email} (${user.id})`);
    });
  } catch (error: unknown) {
    if (error instanceof EmailAlreadyUsedError) {
      console.error("Un compte existe déjà avec cet email.");
      process.exitCode = 1;
      return;
    }
    throw error;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Erreur inconnue.");
  process.exitCode = 1;
});