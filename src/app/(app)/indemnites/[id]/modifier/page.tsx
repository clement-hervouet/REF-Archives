import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { CompensationForm } from "@/components/features/compensations/compensation-form";
import { fr } from "@/i18n/fr";
import { requireUserOrRedirect } from "@/server/auth/session";
import { compensationFormValues } from "@/server/compensation/compensation-form";
import { loadCompensationFormData } from "@/server/compensation/form-data";
import { findCompensationForEdit } from "@/server/db/compensations";
import { getDb } from "@/server/db/pool";
import { updateCompensationAction } from "./actions";

const t = fr.compensations;

// Type explicite plutôt que `PageProps` (généré par `next typegen`) : ESLint tourne en CI
// avant le typecheck, sur un clone sans `.next/types`.
type EditCompensationPageProps = { params: Promise<{ id: string }> };

export default async function EditCompensationPage(props: EditCompensationPageProps) {
  // Chaque page vérifie elle-même (§6.2) : le layout n'est pas rendu à chaque navigation.
  const user = await requireUserOrRedirect();
  const id = z.uuid().safeParse((await props.params).id);
  if (!id.success) {
    notFound();
  }
  const db = getDb();
  // Indemnité d'un autre utilisateur ou supprimée : même réponse qu'une inexistante.
  const compensation = await findCompensationForEdit(db, {
    compensationId: id.data,
    userId: user.id,
  });
  if (compensation === null) {
    notFound();
  }
  const data = await loadCompensationFormData(db, user.id);
  const values = compensationFormValues(compensation);
  // Barème archivé depuis la saisie : il n'est plus proposé, l'utilisateur en choisit un autre.
  const scaleStillSelectable = data.scales.some((scale) => scale.id === compensation.scaleId);
  if (!scaleStillSelectable) {
    values.scaleId = "";
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex max-w-2xl flex-col gap-2">
        <Link href="/indemnites" className="inline-flex min-h-11 items-center self-start underline">
          {t.edit.back}
        </Link>
        <h1 className="text-2xl font-semibold">{t.edit.title}</h1>
        <p className="text-neutral-700">{t.edit.intro}</p>
        {!scaleStillSelectable && (
          <p role="status" className="font-medium">
            {t.edit.archivedScale}
          </p>
        )}
      </section>
      <CompensationForm action={updateCompensationAction} initialValues={values} {...data} />
    </div>
  );
}
