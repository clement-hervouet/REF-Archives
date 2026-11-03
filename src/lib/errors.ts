/** Erreurs typées de l'application (voir CLAUDE.md §7.3). */
export class AppError extends Error {
  override readonly name: string = "AppError";
}

/** Configuration invalide ou manquante (ex. variable d'environnement). */
export class ConfigError extends AppError {
  override readonly name = "ConfigError";
}

/** Utilisateur non authentifié : session absente, expirée ou révoquée. */
export class UnauthorizedError extends AppError {
  override readonly name = "UnauthorizedError";
}

/** Utilisateur authentifié mais sans le droit d'effectuer l'action (ex. rôle insuffisant). */
export class ForbiddenError extends AppError {
  override readonly name = "ForbiddenError";
}

/** Données invalides passées à une fonction interne (erreur de programmation, pas de saisie utilisateur). */
export class ValidationError extends AppError {
  override readonly name = "ValidationError";
}

/** Échec d'envoi d'un email. L'erreur d'origine est conservée dans `cause`, jamais exposée au client. */
export class EmailDeliveryError extends AppError {
  override readonly name = "EmailDeliveryError";
}