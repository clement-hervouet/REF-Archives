export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Code node-only (validation + éventuel process.exit) isolé pour ne pas entrer dans le
    // graphe de l'Edge Runtime, où `process.exit` n'existe pas.
    const { validateEnvOrExit } = await import("./instrumentation-node");
    validateEnvOrExit();
  }
}
