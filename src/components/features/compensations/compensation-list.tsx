/**
 * Indemnités d'un mois, chacune avec son match, son barème et son montant détaillé.
 * Une liste de cartes plutôt qu'un tableau : lisible à 375 px comme sur grand écran.
 */
import Link from "next/link";
import { divisionLabel } from "@/components/features/scales/division-label";
import { fr } from "@/i18n/fr";
import { completeGamePath, gamePath, matchExportPath } from "@/lib/app-paths";
import { toParisIsoDate } from "@/lib/dates";
import { formatRoundTripKm } from "@/lib/distance";
import { formatCents, formatIsoDate } from "@/lib/format";
import { toParisTimeOfDay } from "@/lib/paris-time";
import type { CompensationAmount } from "@/server/compensation/amount";
import type { DeleteCompensationState } from "@/server/compensation/compensation-form";
import type { CompensationListItem } from "@/server/db/compensations";
import { addressLabel } from "./address-label";
import { DeleteCompensationButton } from "./delete-compensation-button";

const t = fr.compensations.list;

export type CompensationWithAmount = CompensationListItem & { amount: CompensationAmount };

type Props = {
  items: readonly CompensationWithAmount[];
  deleteAction: (
    previous: DeleteCompensationState,
    formData: FormData,
  ) => Promise<DeleteCompensationState>;
};

export function CompensationList({ items, deleteAction }: Props) {
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => {
        const date = formatIsoDate(toParisIsoDate(item.startsAt));
        return (
          <li key={item.id}>
            <article className="flex flex-col gap-3 rounded-md border border-border p-4 md:flex-row md:items-start md:justify-between">
              <div className="flex min-w-0 flex-col gap-1">
                <p className="text-sm text-muted-foreground">
                  {t.matchOn
                    .replace("{date}", date)
                    .replace("{time}", toParisTimeOfDay(item.startsAt))}
                </p>
                <h3 className="font-semibold break-words">
                  {t.teams.replace("{team1}", item.team1Name).replace("{team2}", item.team2Name)}
                </h3>
                <p className="text-sm break-words">
                  {t.details
                    .replace("{division}", divisionLabel(item.division))
                    .replace("{address}", addressLabel(item.address))}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t.scale.replace("{scale}", item.scaleName)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t.amounts
                    .replace("{game}", formatCents(item.amount.gameCents))
                    .replace("{mileage}", formatCents(item.amount.mileageCents))
                    .replace("{distance}", formatRoundTripKm(item.distanceM))}
                </p>
              </div>
              <div className="flex flex-col gap-3 md:items-end">
                <p className="text-lg font-semibold tabular-nums">
                  <span className="sr-only">{t.total} : </span>
                  {formatCents(item.amount.totalCents)}
                </p>
                <div className="flex flex-wrap gap-2 md:justify-end">
                  {/* `<a>` et non `<Link>` : c'est un fichier à télécharger, pas une page. */}
                  <a
                    href={matchExportPath(item.id)}
                    download
                    aria-label={fr.calendar.export.ariaLabel.replace("{date}", date)}
                    className="inline-flex min-h-11 items-center rounded-md border border-input px-4"
                  >
                    {fr.calendar.export.label}
                  </a>
                  {/* Bloc 9 : fiche du match complet, ou sa création depuis l'indemnité. */}
                  {item.gameId === null ? (
                    <Link
                      href={completeGamePath(item.id)}
                      aria-label={fr.games.completeMatchLabel.replace("{date}", date)}
                      className="inline-flex min-h-11 items-center rounded-md border border-input px-4"
                    >
                      {fr.games.completeMatch}
                    </Link>
                  ) : (
                    <Link
                      href={gamePath(item.gameId)}
                      aria-label={fr.games.viewMatchLabel.replace("{date}", date)}
                      className="inline-flex min-h-11 items-center rounded-md border border-input px-4"
                    >
                      {fr.games.viewMatch}
                    </Link>
                  )}
                  <Link
                    href={`/indemnites/${item.id}/modifier`}
                    aria-label={t.editLabel.replace("{date}", date)}
                    className="inline-flex min-h-11 items-center rounded-md border border-input px-4"
                  >
                    {t.edit}
                  </Link>
                  <DeleteCompensationButton
                    compensationId={item.id}
                    dateLabel={date}
                    action={deleteAction}
                  />
                </div>
              </div>
            </article>
          </li>
        );
      })}
    </ul>
  );
}
