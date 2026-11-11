/**
 * Carte d'un barème (bloc 10) : nom et date d'effet de la ligne en vigueur, ses deux
 * montants mis en avant, l'historique, puis une rangée d'actions compactes (ajouter une
 * ligne, renommer, supprimer). Composant serveur ; chaque action absente masque son
 * formulaire (lecture seule). Masquer n'est qu'un confort : l'action vérifie les droits.
 */
import { Disclosure } from "@/components/features/common/disclosure";
import { fr } from "@/i18n/fr";
import { toParisIsoDate } from "@/lib/dates";
import { formatCents, formatCentsPerKm, formatIsoDate } from "@/lib/format";
import type { ManagedScale } from "@/server/db/scales";
import type {
  AddRateState,
  DeleteRateState,
  DeleteScaleState,
  RenameScaleState,
} from "@/server/scales/manage-scales";
import { findEffectiveRate } from "@/server/scales/effective-rate";
import { AddRateForm } from "./add-rate-form";
import { DeleteScaleButton } from "./delete-scale-button";
import { RatesTable } from "./rates-table";
import { RenameScaleForm } from "./rename-scale-form";

const t = fr.scales;

type ScaleCardActions = {
  addRate?: (previous: AddRateState, formData: FormData) => Promise<AddRateState>;
  deleteRate?: (previous: DeleteRateState, formData: FormData) => Promise<DeleteRateState>;
  rename?: (previous: RenameScaleState, formData: FormData) => Promise<RenameScaleState>;
  deleteScale?: (previous: DeleteScaleState, formData: FormData) => Promise<DeleteScaleState>;
};

type Props = {
  scale: ManagedScale;
  actions: ScaleCardActions;
  /** Texte affiché quand le barème n'a encore aucune ligne. */
  emptyText: string;
  showUsage?: boolean;
};

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-xl font-semibold whitespace-nowrap tabular-nums">{value}</dd>
    </div>
  );
}

export function ScaleCard({ scale, actions, emptyText, showUsage = false }: Props) {
  const current = findEffectiveRate(scale.rates, toParisIsoDate(new Date()));
  const hasActions =
    actions.addRate !== undefined ||
    actions.rename !== undefined ||
    actions.deleteScale !== undefined;

  return (
    <article className="flex flex-col gap-4 rounded-md border border-border p-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="text-lg font-semibold break-words">{scale.name}</h3>
          <p className="text-sm text-muted-foreground">
            {current === null
              ? t.noCurrent
              : t.since.replace("{date}", formatIsoDate(current.effectiveFrom))}
          </p>
        </div>
        {current !== null && (
          <dl className="flex gap-6">
            <Figure label={t.figures.match} value={formatCents(current.gameAmountCents)} />
            <Figure label={t.figures.rate} value={formatCentsPerKm(current.centsPerKm)} />
          </dl>
        )}
      </header>

      {scale.rates.length === 0 ? (
        <p>{emptyText}</p>
      ) : (
        <div className="flex flex-col gap-1">
          <h4 className="text-sm font-medium text-muted-foreground">{t.history}</h4>
          <RatesTable
            scaleName={scale.name}
            rates={scale.rates}
            currentRateId={current?.id ?? null}
            showUsage={showUsage}
            {...(actions.deleteRate !== undefined ? { deleteAction: actions.deleteRate } : {})}
          />
        </div>
      )}

      {hasActions && (
        // Un panneau ouvert prend toute la ligne ; les autres boutons passent en dessous.
        <div className="flex flex-wrap items-start gap-2">
          {actions.addRate !== undefined && (
            <Disclosure
              summary={t.addRate.title}
              open={scale.rates.length === 0}
              className="open:basis-full"
            >
              <AddRateForm scaleId={scale.id} action={actions.addRate} />
            </Disclosure>
          )}
          {actions.rename !== undefined && (
            <Disclosure summary={t.rename.title} className="open:basis-full">
              <RenameScaleForm
                scaleId={scale.id}
                currentName={scale.name}
                action={actions.rename}
              />
            </Disclosure>
          )}
          {actions.deleteScale !== undefined && (
            <div className="sm:ml-auto has-[form]:basis-full has-[form]:sm:ml-0">
              <DeleteScaleButton scaleId={scale.id} action={actions.deleteScale} />
            </div>
          )}
        </div>
      )}
    </article>
  );
}
