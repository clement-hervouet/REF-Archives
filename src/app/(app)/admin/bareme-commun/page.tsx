import { ScaleCard } from "@/components/features/scales/scale-card";
import { fr } from "@/i18n/fr";
import { requireAdminOrRedirect } from "@/server/auth/session";
import { getDb } from "@/server/db/pool";
import { listOwnedScales } from "@/server/db/scales";
import {
  addCommonScaleRateAction,
  deleteCommonScaleRateAction,
  renameCommonScaleAction,
} from "./actions";

const t = fr.admin.commonScale;

/**
 * Barème commun (admin), sur le modèle de « Mes barèmes » (bloc 10) : même carte (montants
 * en vigueur, historique, actions compactes), sans suppression du barème lui-même.
 */
export default async function CommonScalePage() {
  // Page réservée aux admins : 404 pour un utilisateur simple (§6.2).
  await requireAdminOrRedirect();
  const [common] = await listOwnedScales(getDb(), { kind: "common" });

  return (
    <div className="flex flex-col gap-8">
      <section className="flex max-w-2xl flex-col gap-2">
        <h1 className="text-2xl font-semibold">{t.title}</h1>
        <p className="text-muted-foreground">{t.intro}</p>
      </section>

      <section aria-labelledby="common-scale" className="flex flex-col gap-3">
        <div className="flex max-w-2xl flex-col gap-1">
          <h2 id="common-scale" className="text-lg font-semibold">
            {t.sectionTitle}
          </h2>
          <p className="text-muted-foreground">{t.sectionIntro}</p>
        </div>
        {common === undefined ? (
          <p
            role="alert"
            className="border-l-4 border-destructive pl-3 font-medium text-destructive"
          >
            {t.missing}
          </p>
        ) : (
          <ScaleCard
            scale={common}
            showUsage
            emptyText={t.empty}
            actions={{
              addRate: addCommonScaleRateAction,
              deleteRate: deleteCommonScaleRateAction,
              rename: renameCommonScaleAction,
            }}
          />
        )}
      </section>
    </div>
  );
}
