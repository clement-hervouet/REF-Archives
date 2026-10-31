/** Erreurs typées de l'application (voir CLAUDE.md §7.3). */
export class AppError extends Error {
  override readonly name: string = "AppError";
}

/** Configuration invalide ou manquante (ex. variable d'environnement). */
export class ConfigError extends AppError {
  override readonly name = "ConfigError";
}