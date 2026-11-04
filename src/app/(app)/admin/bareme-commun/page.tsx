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

export default async function CommonScalePage() {
  // Page réservée aux admins : 404 pour un utilisateur simple (§6.2).
  await requireAdminOrRedirect();
  const [common] = await listOwnedScales(getDb(), { kind: "common" });

  return (
    <div className="flex flex-col gap-6">
      <section className="flex max-w-2xl flex-col gap-2">
        <h1 className="text-2xl font-semibold">{t.title}</h1>
        <p className="text-neutral-700">{t.intro}</p>
      </section>
      {common !== undefined && (
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
    </div>
  );
}