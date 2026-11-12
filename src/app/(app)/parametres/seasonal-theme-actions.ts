"use server";

/**
 * Server Action du thème saisonnier : section « Thème saisonnier » de `/parametres` et,
 * à l'étape 12c, bandeau de première apparition d'une saison. Le choix est gardé dans des
 * cookies de cet appareil. Session vérifiée comme pour toute action (§6.2), même si les
 * cookies ne contiennent rien de sensible.
 */
import { revalidatePath } from "next/cache";
import { parseSeasonalForm } from "@/lib/schemas/seasonal";
import { saveSeasonalChoice } from "@/server/account/seasonal-theme";
import { requireUser } from "@/server/auth/session";

export async function updateSeasonalThemeAction(formData: FormData): Promise<void> {
  await requireUser();
  const choice = parseSeasonalForm(formData);
  if (choice === null) {
    // Valeur forgée : rien à enregistrer, la page reste telle quelle.
    return;
  }
  await saveSeasonalChoice(choice);
  // Le calque animé est posé par le layout de l'application : toutes les pages sont concernées.
  revalidatePath("/", "layout");
}
