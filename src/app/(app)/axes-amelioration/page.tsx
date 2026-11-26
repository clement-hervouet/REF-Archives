import { Disclosure } from "@/components/features/common/disclosure";
import { PageTitle } from "@/components/features/common/page-title";
import { ImprovementAxesForm } from "@/components/features/improvement/improvement-axes-form";
import { ImprovementAxesManager } from "@/components/features/improvement/improvement-axes-manager";
import { fr } from "@/i18n/fr";
import { formatDateTime } from "@/lib/format";
import { IMPROVEMENT_AXES } from "@/lib/improvement-axes-fields";
import { requireUserOrRedirect } from "@/server/auth/session";
import { findImprovementAxes } from "@/server/db/improvement-axes";
import { getDb } from "@/server/db/pool";
import { buildAxisList, hiddenAxes, visibleAxes } from "@/server/improvement/axis-list";
import { improvementAxesFormValues } from "@/server/improvement/manage-improvement-axes";
import {
  createImprovementAxisAction,
  deleteImprovementAxisAction,
  renameImprovementAxisAction,
  reorderImprovementAxesAction,
  restoreImprovementAxisAction,
  saveImprovementAxesAction,
} from "./actions";

const t = fr.improvementAxes;

export default async function ImprovementAxesPage() {
  // Chaque page vérifie elle-même (§6.2) : le layout n'est pas rendu à chaque navigation.
  const user = await requireUserOrRedirect();
  const { rows, updatedAt } = await findImprovementAxes(getDb(), user.id);
  const list = buildAxisList(rows);
  const visible = visibleAxes(list);
  const axes = visible.map((item) =>
    item.defaultKey === null
      ? { slot: item.slot, label: item.label, custom: true }
      : { slot: item.slot, label: t.axes[item.defaultKey], custom: false },
  );
  // Dans l'ordre par défaut, quel que soit l'ordre des suppressions.
  const restorable = hiddenAxes(list)
    .sort((a, b) => IMPROVEMENT_AXES.indexOf(a.defaultKey) - IMPROVEMENT_AXES.indexOf(b.defaultKey))
    .map((item) => ({
      slot: item.slot,
      label: t.axes[item.defaultKey],
      custom: false,
    }));

  return (
    <div className="flex flex-col gap-6">
      <section className="flex max-w-2xl flex-col gap-2">
        <PageTitle>{t.title}</PageTitle>
        <p className="text-muted-foreground">{t.intro}</p>
        {updatedAt !== null && (
          <p className="text-sm text-muted-foreground">
            {t.updated.replace("{date}", formatDateTime(updatedAt))}
          </p>
        )}
      </section>

      <Disclosure summary={t.manage.toggle} className="max-w-2xl">
        <ImprovementAxesManager
          axes={axes}
          restorable={restorable}
          actions={{
            reorder: reorderImprovementAxesAction,
            create: createImprovementAxisAction,
            rename: renameImprovementAxisAction,
            remove: deleteImprovementAxisAction,
            restore: restoreImprovementAxisAction,
          }}
        />
      </Disclosure>

      {/* Pas de clé : le message « enregistré » doit survivre au rafraîchissement ; le
          formulaire se remonte lui-même avec les valeurs relues en base. */}
      {axes.length > 0 ? (
        <ImprovementAxesForm
          action={saveImprovementAxesAction}
          axes={axes}
          initialValues={improvementAxesFormValues(visible)}
        />
      ) : (
        <p className="max-w-2xl text-muted-foreground">{t.empty}</p>
      )}
    </div>
  );
}
