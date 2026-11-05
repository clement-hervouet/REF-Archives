/**
 * Historique des lignes d'un barème, de la plus récente à la plus ancienne. Composant
 * serveur : seul le bouton de suppression est un composant client.
 */
import { fr } from "@/i18n/fr";
import { formatCents, formatCentsPerKm, formatIsoDate } from "@/lib/format";
import type { ScaleRate } from "@/server/db/scales";
import type { DeleteRateState } from "@/server/scales/manage-scales";
import { DeleteRateButton } from "./delete-rate-button";

const t = fr.scales;

type Props = {
  scaleName: string;
  rates: readonly ScaleRate[];
  /** Ligne en vigueur aujourd'hui (à Paris), mise en évidence. */
  currentRateId: string | null;
  /** Absent : tableau en lecture seule (barème commun vu par un utilisateur). */
  deleteAction?: (previous: DeleteRateState, formData: FormData) => Promise<DeleteRateState>;
  /** Afficher qu'une ligne est utilisée : seulement sur les lignes du propriétaire. */
  showUsage?: boolean;
};

export function RatesTable({
  scaleName,
  rates,
  currentRateId,
  deleteAction,
  showUsage = false,
}: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <caption className="sr-only">{t.table.caption.replace("{name}", scaleName)}</caption>
        <thead>
          <tr className="border-b border-neutral-400">
            <th scope="col" className="py-2 pr-2 md:pr-3 font-medium">
              {t.table.effectiveFrom}
            </th>
            <th scope="col" className="py-2 pr-2 md:pr-3 font-medium">
              {t.table.gameAmount}
            </th>
            <th scope="col" className="py-2 pr-2 md:pr-3 font-medium">
              {t.table.ratePerKm}
            </th>
            {deleteAction !== undefined && (
              <th scope="col" className="py-2 text-right font-medium">
                <span className="sr-only">{t.table.actions}</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rates.map((rate) => {
            const date = formatIsoDate(rate.effectiveFrom);
            const isCurrent = rate.id === currentRateId;
            return (
              <tr key={rate.id} className="border-b border-neutral-200 align-top">
                <td className="py-2 pr-2 md:pr-3">
                  <span className="whitespace-nowrap">{date}</span>
                  {/* Badges sous la date sur mobile, à côté sur grand écran : pas de débordement à 375 px. */}
                  {(isCurrent || (showUsage && rate.inUse)) && (
                    <span className="mt-1 flex flex-wrap gap-1 md:mt-0 md:ml-2 md:inline-flex">
                      {isCurrent && (
                        <span className="rounded bg-neutral-900 px-1.5 py-0.5 text-xs font-medium text-white">
                          {t.table.current}
                        </span>
                      )}
                      {showUsage && rate.inUse && (
                        <span className="rounded border border-neutral-400 px-1.5 py-0.5 text-xs">
                          {t.table.inUse}
                        </span>
                      )}
                    </span>
                  )}
                </td>
                <td className="py-2 pr-2 md:pr-3 whitespace-nowrap">
                  {formatCents(rate.gameAmountCents)}
                </td>
                <td className="py-2 pr-2 md:pr-3">{formatCentsPerKm(rate.centsPerKm)}</td>
                {deleteAction !== undefined && (
                  <td className="py-1 text-right">
                    <DeleteRateButton rateId={rate.id} dateLabel={date} action={deleteAction} />
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
