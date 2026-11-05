/**
 * Récapitulatif des matchs du weekend (§5.2), construit à partir des indemnités à venir.
 * Les noms d'équipes et les adresses sont saisis par l'utilisateur : le gabarit les
 * échappe dans le HTML, et ils n'apparaissent jamais dans le sujet. Email non essentiel,
 * donc désactivable (§9).
 */
import { addressLabel } from "@/components/features/compensations/address-label";
import { divisionLabel } from "@/components/features/scales/division-label";
import { fr } from "@/i18n/fr";
import { UPCOMING_PATH } from "@/lib/app-paths";
import { formatWeekdayDateTime } from "@/lib/format";
import type { EmailMessage } from "@/lib/schemas/email";
import { formatShortDate } from "@/lib/weeks";
import type { CompensationListItem } from "@/server/db/compensations";
import { renderEmail } from "./layout";

const t = fr.email.weekendRecap;

/** Ce que le récapitulatif affiche d'un match : ni montant, ni barème. */
export type WeekendMatch = Pick<
  CompensationListItem,
  "startsAt" | "team1Name" | "team2Name" | "division" | "address"
>;

export type WeekendRecapEmailInput = {
  email: string;
  /** Samedi du weekend récapitulé, `AAAA-MM-JJ`. */
  saturday: string;
  /** Au moins un match, dans l'ordre chronologique. */
  matches: readonly WeekendMatch[];
  /** `APP_URL` validée (jamais l'en-tête Host). */
  appUrl: string;
};

/** Ligne d'un match, ex. « samedi 07/11 à 20:30 : BC Béthune – ES Lens (…), 2 Rue … ». */
export function weekendMatchLine(match: WeekendMatch): string {
  return t.matchLine
    .replace("{when}", formatWeekdayDateTime(match.startsAt))
    .replace("{team1}", match.team1Name)
    .replace("{team2}", match.team2Name)
    .replace("{division}", divisionLabel(match.division))
    .replace("{address}", addressLabel(match.address));
}

/** Construit le récapitulatif. Le job n'appelle cette fonction que s'il y a des matchs. */
export function buildWeekendRecapEmail(input: WeekendRecapEmailInput): EmailMessage {
  const count = input.matches.length;
  const intro = count === 1 ? t.countOne : t.countMany.replace("{count}", String(count));
  const { text, html } = renderEmail({
    title: t.title,
    paragraphs: [intro, ...input.matches.map(weekendMatchLine)],
    action: {
      label: t.action,
      url: `${input.appUrl}${UPCOMING_PATH}`,
      fallback: fr.email.linkFallback,
    },
    footer: fr.email.reminderFooter,
  });
  const subject = t.subject.replace("{date}", formatShortDate(input.saturday));
  return { to: input.email, subject, text, html };
}
