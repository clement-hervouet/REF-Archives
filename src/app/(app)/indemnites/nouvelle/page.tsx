import Link from "next/link";
import { CompensationForm } from "@/components/features/compensations/compensation-form";
import { fr } from "@/i18n/fr";
import { requireUserOrRedirect } from "@/server/auth/session";
import { loadCompensationFormData } from "@/server/compensation/form-data";
import { getDb } from "@/server/db/pool";
import { createCompensationAction } from "./actions";

const t = fr.compensations;

export default async function NewCompensationPage() {
  // Chaque page vérifie elle-même (§6.2) : le layout n'est pas rendu à chaque navigation.
  const user = await requireUserOrRedirect();
  const data = await loadCompensationFormData(getDb(), user.id);

  return (
    <div className="flex flex-col gap-6">
      <section className="flex max-w-2xl flex-col gap-2">
        <Link href="/indemnites" className="inline-flex min-h-11 items-center self-start underline">
          {t.edit.back}
        </Link>
        <h1 className="text-2xl font-semibold">{t.new.title}</h1>
        <p className="text-muted-foreground">{t.new.intro}</p>
      </section>
      <CompensationForm action={createCompensationAction} {...data} />
    </div>
  );
}
