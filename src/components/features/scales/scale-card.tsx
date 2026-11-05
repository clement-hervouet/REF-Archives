/**
 * Carte d'un barème : ligne en vigueur, historique et actions disponibles. Composant
 * serveur ; chaque action absente masque le formulaire correspondant (lecture seule).
 * Masquer un formulaire n'est qu'un confort : les droits sont vérifiés par l'action.
 */
import { fr } from "@/i18n/fr";
import { toParisIsoDate } from "@/lib/dates";
import { formatCents, formatCentsPerKm } from "@/lib/format";
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

export type ScaleCardActions = {
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

const DETAILS_CLASS = "rounded-md border border-neutral-300 p-3";
const SUMMARY_CLASS = "flex min-h-11 cursor-pointer items-center font-medium";

export function ScaleCard({ scale, actions, emptyText, showUsage = false }: Props) {
  const current = findEffectiveRate(scale.rates, toParisIsoDate(new Date()));

  return (
    <article className="flex flex-col gap-4 rounded-md border border-neutral-400 p-3 md:p-4">
      <header className="flex flex-col gap-1">
        <h3 className="text-lg font-semibold break-words">{scale.name}</h3>
        <p className="text-sm text-neutral-700">
          {current === null
            ? t.noCurrent
            : t.current
                .replace("{amount}", formatCents(current.gameAmountCents))
                .replace("{rate}", formatCentsPerKm(current.centsPerKm))}
        </p>
      </header>

      {scale.rates.length === 0 ? (
        <p>{emptyText}</p>
      ) : (
        <RatesTable
          scaleName={scale.name}
          rates={scale.rates}
          currentRateId={current?.id ?? null}
          showUsage={showUsage}
          {...(actions.deleteRate !== undefined ? { deleteAction: actions.deleteRate } : {})}
        />
      )}

      {actions.addRate !== undefined && (
        <details className={DETAILS_CLASS} open={scale.rates.length === 0}>
          <summary className={SUMMARY_CLASS}>{t.addRate.title}</summary>
          <div className="pt-3">
            <AddRateForm scaleId={scale.id} action={actions.addRate} />
          </div>
        </details>
      )}

      {actions.rename !== undefined && (
        <details className={DETAILS_CLASS}>
          <summary className={SUMMARY_CLASS}>{t.rename.title}</summary>
          <div className="pt-3">
            <RenameScaleForm scaleId={scale.id} currentName={scale.name} action={actions.rename} />
          </div>
        </details>
      )}

      {actions.deleteScale !== undefined && (
        <DeleteScaleButton scaleId={scale.id} action={actions.deleteScale} />
      )}
    </article>
  );
}
