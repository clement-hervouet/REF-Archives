import { Disclosure } from "@/components/features/common/disclosure";
import { CreateScaleForm } from "@/components/features/scales/create-scale-form";
import { LevelDefaults } from "@/components/features/scales/level-defaults";
import { ScaleCard } from "@/components/features/scales/scale-card";
import { PageTitle } from "@/components/features/common/page-title";
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
    <div className="flex flex-col gap-8">
      <section className="flex max-w-2xl flex-col gap-2">
        <PageTitle>{t.title}</PageTitle>
        <p className="text-muted-foreground">{t.intro}</p>
      </section>

      <section aria-labelledby="scales-mine" className="flex flex-col gap-3">
        <h2 id="scales-mine" className="text-lg font-semibold">
          {t.mine.title}
        </h2>
        {mine.length === 0 && <p className="text-muted-foreground">{t.mine.empty}</p>}
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
        {/* Ouvert d'office tant qu'il n'y a aucun barème personnel. */}
        <Disclosure summary={t.create.title} open={mine.length === 0}>
          <CreateScaleForm action={createScaleAction} />
        </Disclosure>
      </section>

      <section aria-labelledby="scales-common" className="flex flex-col gap-3">
        <div className="flex max-w-2xl flex-col gap-1">
          <h2 id="scales-common" className="text-lg font-semibold">
            {t.common.title}
          </h2>
          <p className="text-muted-foreground">{t.common.intro}</p>
        </div>
        {/* Lecture seule : aucune action, et l'usage par d'autres comptes n'est jamais affiché. */}
        {common.map((scale) => (
          <ScaleCard key={scale.id} scale={scale} actions={{}} emptyText={t.common.empty} />
        ))}
      </section>

      <section aria-labelledby="scales-defaults" className="flex flex-col gap-3">
        <div className="flex max-w-2xl flex-col gap-1">
          <h2 id="scales-defaults" className="text-lg font-semibold">
            {t.defaults.title}
          </h2>
          <p className="text-muted-foreground">{t.defaults.intro}</p>
        </div>
        {mine.length === 0 ? (
          <p className="text-muted-foreground">{t.defaults.needScale}</p>
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
