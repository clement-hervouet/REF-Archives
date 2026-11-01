export const fr = {
  app: {
    name: "REF-Archives",
    tagline: "Indemnités, disponibilités et notes d'arbitre.",
  },
  auth: {
    login: {
      title: "Connexion",
      email: "Adresse email",
      password: "Mot de passe",
      submit: "Se connecter",
      submitting: "Connexion en cours…",
    },
    logout: "Se déconnecter",
    signedInAs: "Connecté en tant que {email}",
    errors: {
      // Volontairement identique que l'email existe ou non (§6.1).
      invalidCredentials: "Email ou mot de passe incorrect.",
      rateLimited: "Trop de tentatives de connexion. Réessayez dans {minutes} min.",
      unexpected: "Une erreur est survenue. Réessayez dans un instant.",
    },
  },
} as const;