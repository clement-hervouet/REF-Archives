/**
 * Configuration Auth.js v5 : connexion email + mot de passe, JWT minimal (un sessionId)
 * et session révocable grâce à la table `session` (voir `session.ts`).
 */
import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { loginSchema } from "@/lib/schemas/auth";
import { getDb } from "../db/pool";
import { SESSION_MAX_AGE_SECONDS, revokeSession } from "../db/sessions";
import { getClientIp } from "./client-ip";
import { authenticate } from "./login";
import { createLoginDeps } from "./login-deps";

/** Trop de tentatives : transporte le délai restant jusqu'à la Server Action de connexion. */
export class RateLimitedError extends CredentialsSignin {
  override code = "rate_limited";
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super();
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

// Forme de l'utilisateur renvoyé par `authorize` : seul le sessionId nous intéresse.
const signedInUserSchema = z.object({ sessionId: z.uuid() });

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async (credentials, request) => {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) {
          return null;
        }
        const result = await authenticate(createLoginDeps(), {
          email: parsed.data.email,
          password: parsed.data.password,
          ip: getClientIp(request.headers),
        });
        if (result.status === "rate_limited") {
          throw new RateLimitedError(result.retryAfterSeconds);
        }
        if (result.status === "invalid_credentials") {
          return null;
        }
        return { id: result.userId, sessionId: result.sessionId };
      },
    }),
  ],
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_SECONDS },
  pages: { signIn: "/login" },
  // Derrière Caddy, l'hôte public vient de X-Forwarded-Host.
  trustHost: true,
  callbacks: {
    jwt({ token, user }) {
      // `user` n'est défini qu'à la connexion, même si son type ne le dit pas :
      // on le valide plutôt que de se fier au type.
      const signedIn = signedInUserSchema.safeParse(user);
      if (signedIn.success) {
        token.sessionId = signedIn.data.sessionId;
      }
      return token;
    },
    session({ session, token }) {
      if (token.sessionId !== undefined) {
        session.sessionId = token.sessionId;
      }
      return session;
    },
  },
  events: {
    // Couvre aussi la déconnexion par le point d'accès /api/auth/signout.
    async signOut(message) {
      if ("token" in message && message.token?.sessionId !== undefined) {
        await revokeSession(getDb(), message.token.sessionId);
      }
    },
  },
});