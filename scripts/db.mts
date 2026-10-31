/**
 * Outils de base de données pour le développement local : migrate, seed, reset.
 * Lancé via les scripts `pnpm db:*` : Node charge `.env.local` avec `--env-file`.
 */
import { readFile } from "node:fs/promises";
import { runner } from "node-pg-migrate";
import pg from "pg";
import { z } from "zod";

const MIGRATIONS_DIR = "db/migrations";
const MIGRATIONS_TABLE = "pgmigrations";
const SEED_FILE = "db/seed.sql";
// Garde-fou : `reset` détruit tout le schéma, on ne l'autorise que sur une base locale.
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

const envSchema = z.object({ DATABASE_URL: z.url() });

type Command = "migrate" | "seed" | "reset";

function parseCommand(value: string | undefined): Command | null {
  if (value === "migrate" || value === "seed" || value === "reset") {
    return value;
  }
  return null;
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

async function migrate(databaseUrl: string): Promise<void> {
  await runner({
    databaseUrl,
    dir: MIGRATIONS_DIR,
    direction: "up",
    migrationsTable: MIGRATIONS_TABLE,
  });
}

async function seed(databaseUrl: string): Promise<void> {
  const sql = await readFile(SEED_FILE, "utf8");
  // Une requête multi-instructions s'exécute en une seule transaction implicite.
  await withClient(databaseUrl, async (client) => {
    await client.query(sql);
  });
}

async function reset(databaseUrl: string): Promise<void> {
  const { hostname } = new URL(databaseUrl);
  if (!LOCAL_HOSTNAMES.has(hostname)) {
    console.error("db:reset refusé : la base n'est pas locale.");
    process.exitCode = 1;
    return;
  }
  await withClient(databaseUrl, async (client) => {
    await client.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  });
  await migrate(databaseUrl);
  await seed(databaseUrl);
}

async function main(): Promise<void> {
  const command = parseCommand(process.argv[2]);
  if (command === null) {
    console.error("Usage : db.mts <migrate|seed|reset>");
    process.exitCode = 1;
    return;
  }

  const env = envSchema.safeParse(process.env);
  if (!env.success) {
    // On ne nomme que la variable, jamais sa valeur (elle contient le mot de passe).
    console.error("DATABASE_URL est absente ou invalide (voir .env.example).");
    process.exitCode = 1;
    return;
  }
  const databaseUrl = env.data.DATABASE_URL;

  switch (command) {
    case "migrate":
      await migrate(databaseUrl);
      break;
    case "seed":
      await seed(databaseUrl);
      break;
    case "reset":
      await reset(databaseUrl);
      break;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Erreur inconnue.");
  process.exitCode = 1;
});