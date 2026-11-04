import { CompensationForm } from "@/components/features/compensations/compensation-form";
import { fr } from "@/i18n/fr";
import { requireUserOrRedirect } from "@/server/auth/session";
import { listAddresses, listClubs } from "@/server/db/clubs";
import { listDivisions } from "@/server/db/divisions";
import { getDb } from "@/server/db/pool";
import { findCommonScaleId, listLevelDefaults, listSelectableScales } from "@/server/db/scales";
import { resolveDefaultScaleId } from "@/server/scales/default-scale";
import { createCompensationAction } from "./actions";

const t = fr.compensations;

export default async function NewCompensationPage() {
  // Chaque page vérifie elle-même (§6.2) : le layout n'est pas rendu à chaque navigation.
  const user = await requireUserOrRedirect();
  const db = getDb();
  const [divisions, scales, levelDefaults, commonScaleId, clubs, addresses] = await Promise.all([
    listDivisions(db),
    listSelectableScales(db, user.id),
    listLevelDefaults(db, user.id),
    findCommonScaleId(db),
    listClubs(db, user.id),
    listAddresses(db, user.id),
  ]);

  // Barème présélectionné pour chaque niveau, calculé ici : le client ne reçoit que le résultat.
  const selectableScaleIds = new Set(scales.map((scale) => scale.id));
  const defaultScaleByDivision: Record<string, string> = {};
  for (const division of divisions) {
    defaultScaleByDivision[division.id] = resolveDefaultScaleId({
      divisionId: division.id,
      levelDefaults,
      commonScaleId,
      selectableScaleIds,
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex max-w-2xl flex-col gap-2">
        <h1 className="text-2xl font-semibold">{t.new.title}</h1>
        <p className="text-neutral-700">{t.new.intro}</p>
      </section>
      <CompensationForm
        action={createCompensationAction}
        divisions={divisions}
        scales={scales.map((scale) => ({ id: scale.id, name: scale.name }))}
        defaultScaleByDivision={defaultScaleByDivision}
        clubs={clubs}
        addresses={addresses}
      />
    </div>
  );
}
