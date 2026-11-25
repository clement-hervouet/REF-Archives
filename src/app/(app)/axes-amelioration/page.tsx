import { PageTitle } from "@/components/features/common/page-title";
import { ImprovementAxesForm } from "@/components/features/improvement/improvement-axes-form";
import { fr } from "@/i18n/fr";
import { formatDateTime } from "@/lib/format";
import { requireUserOrRedirect } from "@/server/auth/session";
import { findImprovementAxes } from "@/server/db/improvement-axes";
import { getDb } from "@/server/db/pool";
import { improvementAxesFormValues } from "@/server/improvement/improvement-axes-form";
import { saveImprovementAxesAction } from "./actions";

const t = fr.improvementAxes;

export default async function ImprovementAxesPage() {
  // Chaque page vérifie elle-même (§6.2) : le layout n'est pas rendu à chaque navigation.
  const user = await requireUserOrRedirect();
  const axes = await findImprovementAxes(getDb(), user.id);

  return (
    <div className="flex flex-col gap-6">
      <section className="flex max-w-2xl flex-col gap-2">
        <PageTitle>{t.title}</PageTitle>
        <p className="text-muted-foreground">{t.intro}</p>
        {axes !== null && (
          <p className="text-sm text-muted-foreground">
            {t.updated.replace("{date}", formatDateTime(axes.updatedAt))}
          </p>
        )}
      </section>

      {/* Pas de clé : le message « enregistré » doit survivre au rafraîchissement ; le
          formulaire se remonte lui-même avec les valeurs relues en base. */}
      <ImprovementAxesForm
        action={saveImprovementAxesAction}
        initialValues={improvementAxesFormValues(axes)}
      />
    </div>
  );
}
