/**
 * Libellés de la page « Mes indemnités » (bloc 10) : nombre de matchs, état de paiement
 * d'un mois dans le tableau de saison. Purs et sans React.
 */
import { fr } from "@/i18n/fr";
import type { MonthlyTotal } from "@/server/compensation/monthly-totals";

const t = fr.compensations;

export function matchCountLabel(count: number): string {
  if (count === 0) return t.month.countNone;
  if (count === 1) return t.month.countOne;
  return t.month.countMany.replace("{count}", String(count));
}

/**
 * État de paiement d'un mois, en toutes lettres (jamais la couleur seule) : ce qui reste
 * en attente d'abord, puis ce qui n'est pas encore dû.
 */
export function monthPaymentLabel(
  total: Pick<MonthlyTotal, "gameCount" | "pendingCount" | "upcomingCount">,
): string {
  if (total.pendingCount === 1) return t.season.pendingOne;
  if (total.pendingCount > 1) {
    return t.season.pendingMany.replace("{count}", String(total.pendingCount));
  }
  if (total.upcomingCount === total.gameCount) return t.season.allUpcoming;
  if (total.upcomingCount > 0) {
    return t.season.paidSomeUpcoming.replace("{count}", String(total.upcomingCount));
  }
  return t.season.allPaid;
}
