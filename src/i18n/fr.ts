export const fr = {
  app: {
    name: "REF-Archives",
    tagline: "Indemnités, disponibilités et notes d'arbitre.",
  },
  nav: {
    invitations: "Invitations",
    scales: "Mes barèmes",
    commonScale: "Barème commun",
  },
  auth: {
    login: {
      title: "Connexion",
      email: "Adresse email",
      password: "Mot de passe",
      submit: "Se connecter",
      submitting: "Connexion en cours…",
      forgotPassword: "Mot de passe oublié ?",
      passwordResetDone: "Votre mot de passe a été modifié. Connectez-vous avec le nouveau.",
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
  forgotPassword: {
    title: "Mot de passe oublié",
    intro:
      "Saisissez l'adresse email de votre compte. Si elle correspond à un compte, vous recevrez un lien pour choisir un nouveau mot de passe.",
    email: "Adresse email",
    submit: "Envoyer le lien",
    submitting: "Envoi en cours…",
    // Identique que le compte existe ou non (§6.1).
    requested:
      "Si un compte existe avec l'adresse {email}, un email contenant un lien de réinitialisation vient d'être envoyé. Le lien est valable {minutes} minutes.",
    backToLogin: "Retour à la connexion",
    errors: {
      invalidEmail: "Cette adresse email n'est pas valide.",
      rateLimited: "Trop de demandes. Réessayez dans {minutes} min.",
    },
  },
  resetPassword: {
    title: "Nouveau mot de passe",
    intro: "Choisissez un nouveau mot de passe. Vous serez déconnecté de tous vos appareils.",
    password: "Nouveau mot de passe",
    confirmation: "Confirmer le mot de passe",
    submit: "Changer mon mot de passe",
    submitting: "Modification en cours…",
    // Identique que le lien soit inconnu, expiré ou déjà utilisé (§6.1).
    invalid: "Ce lien de réinitialisation n'est pas valide ou a expiré.",
    requestNew: "Demander un nouveau lien",
    errors: {
      mismatch: "Les deux mots de passe ne correspondent pas.",
      rateLimited: "Trop de tentatives. Réessayez dans {minutes} min.",
    },
  },
  scales: {
    title: "Mes barèmes",
    intro:
      "Un barème fixe l'indemnité de match et le taux kilométrique à partir d'une date. Pour changer un montant, ajoutez une ligne avec une nouvelle date : les indemnités déjà saisies gardent l'ancienne.",
    current: "En vigueur : {amount} · {rate}",
    noCurrent: "Aucune ligne en vigueur aujourd'hui.",
    common: {
      title: "Barème commun",
      intro:
        "Partagé par tous et tenu à jour par l'administrateur. Il s'applique à chaque niveau pour lequel vous n'avez pas choisi de barème.",
      empty: "Le barème commun n'a pas encore de montant : l'administrateur doit le compléter.",
    },
    mine: {
      title: "Mes barèmes personnels",
      empty: "Vous n'avez pas encore de barème personnel.",
    },
    create: {
      title: "Créer un barème",
      submit: "Créer le barème",
      submitting: "Création en cours…",
      created: "Barème créé.",
    },
    fields: {
      name: "Nom du barème",
      effectiveFrom: "À partir du",
      gameAmount: "Indemnité de match (€)",
      gameAmountHint: "Par exemple 45 ou 45,50",
      ratePerKm: "Taux kilométrique (€/km)",
      ratePerKmHint: "Par exemple 0,40 ou 0,425",
    },
    table: {
      caption: "Historique du barème {name}",
      effectiveFrom: "À partir du",
      gameAmount: "Match",
      ratePerKm: "Taux km",
      actions: "Actions",
      current: "En vigueur",
      inUse: "Utilisée",
    },
    addRate: {
      title: "Ajouter une ligne",
      submit: "Ajouter la ligne",
      submitting: "Ajout en cours…",
      added: "Ligne ajoutée.",
    },
    rename: {
      title: "Renommer",
      label: "Nouveau nom",
      submit: "Renommer",
      submitting: "Enregistrement…",
      renamed: "Barème renommé.",
    },
    deleteRate: {
      submit: "Supprimer",
      label: "Supprimer la ligne du {date}",
      deleted: "Ligne supprimée.",
    },
    deleteScale: {
      submit: "Supprimer le barème",
      confirm: "Confirmer la suppression",
      cancel: "Annuler",
      warning:
        "S'il est utilisé par une indemnité, le barème sera archivé : il ne sera plus proposé, mais l'historique sera conservé.",
      archived: "Barème archivé : il était utilisé par une indemnité.",
    },
    defaults: {
      title: "Barème par défaut par niveau",
      intro:
        "Choisissez le barème présélectionné quand vous saisirez une indemnité pour un niveau. Vous pourrez toujours en choisir un autre.",
      needScale: "Créez d'abord un barème personnel pour l'associer à un niveau.",
      common: "Barème commun",
      label: "Barème par défaut pour {division}",
      submit: "Enregistrer",
      submitting: "…",
      saved: "Enregistré",
      customized: "{count} niveau(x) personnalisé(s)",
    },
    divisions: {
      category: {
        Departemental: "Départemental",
        Regional: "Régional",
        National: "National",
        Pro: "Pro",
      },
      type: {
        Masculin: "Masculin",
        Feminin: "Féminin",
      },
      label: "{category} {type} {level}",
    },
    errors: {
      name: "Le nom doit contenir entre 1 et 100 caractères, sur une seule ligne.",
      effectiveFrom: "Saisissez une date valide, entre 2000 et 2100.",
      gameAmount: "Montant invalide : saisissez par exemple 45 ou 45,50.",
      ratePerKm: "Taux invalide : saisissez par exemple 0,40 ou 0,425.",
      nameTaken: "Vous avez déjà un barème avec ce nom.",
      dateTaken: "Ce barème a déjà une ligne à cette date.",
      scaleLimit: "Vous avez atteint le nombre maximal de barèmes.",
      rateLimit: "Ce barème a atteint le nombre maximal de lignes.",
      notFound: "Cet élément n'existe plus. Rechargez la page.",
      rateInUse: "Cette ligne est utilisée par une indemnité : elle ne peut pas être supprimée.",
      lastRate: "Un barème garde toujours au moins une ligne.",
      invalid: "Choix invalide. Rechargez la page.",
    },
  },
  admin: {
    commonScale: {
      title: "Barème commun",
      intro:
        "Ce barème est proposé à tous les utilisateurs et s'applique par défaut à tous les niveaux. Pour changer un montant, ajoutez une ligne avec une nouvelle date : les indemnités déjà saisies gardent l'ancienne.",
      empty:
        "Aucune ligne pour l'instant : ajoutez la première pour que les utilisateurs puissent saisir des indemnités.",
    },
    invitations: {
      title: "Invitations",
      intro:
        "Invitez une personne à créer un compte : elle reçoit le lien par email. Le lien est valable 72 heures et n'est affiché ici qu'une seule fois.",
      email: "Adresse email de la personne invitée",
      submit: "Créer l'invitation",
      submitting: "Création en cours…",
      createdAndSent:
        "Invitation créée et envoyée à {email}. Vous pouvez aussi lui transmettre ce lien :",
      createdNotSent:
        "Invitation créée pour {email}, mais l'email n'a pas pu être envoyé. Transmettez-lui ce lien :",
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
        rateLimited: "Trop d'invitations envoyées. Réessayez dans {minutes} min.",
      },
    },
  },
  email: {
    footer:
      "Vous recevez cet email car une action a été demandée sur REF-Archives. Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.",
    // Alertes de sécurité : sans lien, et jamais de demande de mot de passe (anti-hameçonnage).
    securityFooter:
      "Cet email est une alerte de sécurité de REF-Archives. Il ne contient aucun lien et ne vous demandera jamais votre mot de passe.",
    linkFallback: "Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :",
    test: {
      subject: "Test d'envoi REF-Archives",
      title: "Test d'envoi",
      body: "Si vous lisez ce message, la configuration SMTP de REF-Archives fonctionne.",
      action: "Ouvrir REF-Archives",
    },
    invitation: {
      subject: "Invitation à rejoindre REF-Archives",
      title: "Vous êtes invité sur REF-Archives",
      body: "Un administrateur vous invite à créer votre compte sur REF-Archives.",
      validity: "Ce lien est valable {hours} heures et ne peut être utilisé qu'une seule fois.",
      action: "Créer mon compte",
      footer:
        "Vous recevez cet email car un administrateur de REF-Archives a saisi votre adresse. Si vous ne souhaitez pas créer de compte, ignorez ce message : le lien expirera de lui-même.",
    },
    passwordReset: {
      subject: "Réinitialisation de votre mot de passe REF-Archives",
      title: "Réinitialiser votre mot de passe",
      body: "Une réinitialisation du mot de passe de votre compte REF-Archives a été demandée.",
      validity: "Ce lien est valable {minutes} minutes et ne peut être utilisé qu'une seule fois.",
      action: "Choisir un nouveau mot de passe",
      footer:
        "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message : votre mot de passe ne sera pas modifié.",
    },
    passwordChanged: {
      subject: "Votre mot de passe REF-Archives a été modifié",
      title: "Mot de passe modifié",
      body: "Le mot de passe de votre compte REF-Archives vient d'être modifié et toutes vos sessions ont été fermées.",
      advice:
        "Si vous êtes à l'origine de ce changement, vous n'avez rien à faire. Sinon, utilisez « Mot de passe oublié ? » sur la page de connexion pour choisir un nouveau mot de passe, et prévenez l'administrateur.",
    },
    accountLocked: {
      subject: "Connexions suspendues sur votre compte REF-Archives",
      title: "Connexions temporairement suspendues",
      body: "Plusieurs tentatives de connexion ont échoué sur votre compte REF-Archives. Par sécurité, les connexions sont suspendues pendant {minutes} minutes.",
      advice:
        "Si c'était vous, patientez avant de réessayer. Sinon, utilisez « Mot de passe oublié ? » sur la page de connexion pour choisir un nouveau mot de passe.",
    },
  },
} as const;