export const fr = {
  app: {
    name: "REF-Archives",
    tagline: "Indemnités, disponibilités et notes d'arbitre.",
  },
  nav: {
    invitations: "Invitations",
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
  validation: {
    passwordTooShort: "Le mot de passe doit contenir au moins 12 caractères.",
    passwordTooLong: "Le mot de passe est trop long (128 caractères maximum).",
    passwordTooCommon: "Ce mot de passe est trop courant : choisissez-en un autre.",
    passwordInvalid: "Le mot de passe n'est pas valide.",
  },
  invitation: {
    title: "Créer votre compte",
    intro: "Vous avez été invité avec l'adresse {email}. Choisissez votre mot de passe.",
    password: "Mot de passe",
    passwordHint: "12 caractères minimum. Une phrase de passe fonctionne très bien.",
    confirmation: "Confirmer le mot de passe",
    submit: "Créer mon compte",
    submitting: "Création en cours…",
    // Identique que le lien soit inconnu, expiré, déjà utilisé ou révoqué (§6.1).
    invalid: "Ce lien d'invitation n'est pas valide ou a expiré. Demandez-en un nouveau.",
    errors: {
      mismatch: "Les deux mots de passe ne correspondent pas.",
    },
  },
  admin: {
    invitations: {
      title: "Invitations",
      intro:
        "Invitez une personne à créer un compte. Le lien est valable 72 heures et n'est affiché qu'une seule fois.",
      email: "Adresse email de la personne invitée",
      submit: "Créer l'invitation",
      submitting: "Création en cours…",
      created: "Invitation créée pour {email}. Transmettez-lui ce lien :",
      linkLabel: "Lien d'invitation",
      copy: "Copier le lien",
      copied: "Lien copié",
      expiresOn: "Expire le {date}",
      listTitle: "Invitations envoyées",
      empty: "Aucune invitation pour le moment.",
      revoke: "Révoquer",
      revokeFor: "Révoquer l'invitation de {email}",
      status: {
        pending: "En attente",
        accepted: "Acceptée",
        revoked: "Révoquée",
        expired: "Expirée",
      },
      errors: {
        invalidEmail: "Cette adresse email n'est pas valide.",
        emailTaken: "Un compte existe déjà avec cette adresse.",
      },
    },
  },
} as const;