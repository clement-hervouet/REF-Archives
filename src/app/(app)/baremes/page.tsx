import { CreateScaleForm } from "@/components/features/scales/create-scale-form";
import { LevelDefaults } from "@/components/features/scales/level-defaults";
import { ScaleCard } from "@/components/features/scales/scale-card";
import { fr } from "@/i18n/fr";
import { requireUserOrRedirect } from "@/server/auth/session";
import { listDivisions } from "@/server/db/divisions";
import { getDb } from "@/server/db/pool";
import { listLevelDefaults, listOwnedScales } from "@/server/db/scales";
import {
  addScaleRateAction,
  createScaleAction,
  deleteScaleAction,
  deleteScaleRateAction,
  renameScaleAction,
  setLevelDefaultAction,
} from "./actions";

const t = fr.scales;

export default async function ScalesPage() {
  // Chaque page vérifie elle-même (§6.2) : le layout n'est pas rendu à chaque navigation.
  const user = await requireUserOrRedirect();
  const db = getDb();
  const [mine, common, defaults, divisions] = await Promise.all([
    listOwnedScales(db, { kind: "user", userId: user.id }),
    listOwnedScales(db, { kind: "common" }),
    listLevelDefaults(db, user.id),
    listDivisions(db),
  ]);

  return (
    <div className="flex flex-col gap-10">
      <section className="flex max-w-2xl flex-col gap-2">
        <h1 className="text-2xl font-semibold">{t.title}</h1>
        <p className="text-neutral-700">{t.intro}</p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t.common.title}</h2>
        <p className="max-w-2xl text-neutral-700">{t.common.intro}</p>
        {/* Lecture seule : aucune action, et l'usage par d'autres comptes n'est jamais affiché. */}
        {common.map((scale) => (
          <ScaleCard key={scale.id} scale={scale} actions={{}} emptyText={t.common.empty} />
        ))}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">{t.mine.title}</h2>
        {mine.length === 0 && <p>{t.mine.empty}</p>}
        {mine.map((scale) => (
          <ScaleCard
            key={scale.id}
            scale={scale}
            showUsage
            emptyText={t.mine.empty}
            actions={{
              addRate: addScaleRateAction,
              deleteRate: deleteScaleRateAction,
              rename: renameScaleAction,
              deleteScale: deleteScaleAction,
            }}
          />
        ))}
        <div className="flex flex-col gap-3 rounded-md border border-neutral-300 p-4">
          <h3 className="font-semibold">{t.create.title}</h3>
          <CreateScaleForm action={createScaleAction} />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t.defaults.title}</h2>
        <p className="max-w-2xl text-neutral-700">{t.defaults.intro}</p>
        {mine.length === 0 ? (
          <p>{t.defaults.needScale}</p>
        ) : (
          <LevelDefaults
            divisions={divisions}
            defaults={defaults}
            scales={mine.map((scale) => ({ id: scale.id, name: scale.name }))}
            action={setLevelDefaultAction}
          />
        )}
      </section>
    </div>
  );
}
