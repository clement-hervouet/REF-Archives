"use server";

/**
 * Server Action de la section « Apparence » : enregistre le thème dans un cookie de cet
 * appareil. Session vérifiée comme pour toute action (§6.2), même si le cookie ne contient
 * rien de sensible.
 */
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { THEME_COOKIE, THEME_COOKIE_MAX_AGE_SECONDS, parseThemeForm } from "@/lib/theme";
import { requireUser } from "@/server/auth/session";

export async function updateThemeAction(formData: FormData): Promise<void> {
  await requireUser();
  const theme = parseThemeForm(formData);
  if (theme === null) {
    // Valeur forgée : rien à enregistrer, la page reste telle quelle.
    return;
  }

  const cookieStore = await cookies();
  if (theme === "system") {
    cookieStore.delete(THEME_COOKIE);
  } else {
    cookieStore.set(THEME_COOKIE, theme, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: THEME_COOKIE_MAX_AGE_SECONDS,
    });
  }
  // Le thème est posé par le layout racine : toutes les pages sont concernées.
  revalidatePath("/", "layout");
}
