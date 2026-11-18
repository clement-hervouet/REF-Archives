/**
 * Récapitulatifs des matchs (§5.2) : celui du weekend (envoyé à partir du jeudi) et celui
 * des matchs de semaine, du lundi au jeudi (envoyé le lundi). Construits à partir des
 * indemnités à venir, avec les officiels du match complet lié (bloc 9).
 * Les noms d'équipes, de collègues et les adresses sont saisis par l'utilisateur : le
 * gabarit les échappe dans le HTML, et ils n'apparaissent jamais dans le sujet. Email non essentiel,
 * donc désactivable (§9).
 */
import { withTeams } from "@/lib/match-teams";
import { addressLabel } from "@/components/features/compensations/address-label";
import { officialsSummary } from "@/components/features/games/officials-summary";
import { matchLevelLabel } from "@/components/features/scales/division-label";
import { fr } from "@/i18n/fr";
import { UPCOMING_PATH } from "@/lib/app-paths";
import { formatWeekdayDateTime } from "@/lib/format";
import type { EmailMessage } from "@/lib/schemas/email";
import { formatShortDate } from "@/lib/weeks";
import type { UpcomingMatchRow } from "@/server/db/upcoming-matches";
import { renderEmail } from "./layout";

const t = fr.email.weekendRecap;
const tWeekday = fr.email.weekdayRecap;

/** Ce que le récapitulatif affiche d'un match : ni montant, ni barème. */
export type WeekendMatch = Pick<
  UpcomingMatchRow,
  "startsAt" | "team1Name" | "team2Name" | "division" | "address" | "officials"
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

/**
 * Paragraphe d'un match, ex. « samedi 07/11 à 20:30 : BC Béthune – ES Lens (…), 2 Rue … »,
 * suivi des officiels quand le match complet existe.
 */
export function weekendMatchLine(match: WeekendMatch): string {
  const line = withTeams(t.matchLine, match.team1Name, match.team2Name)
    .replace("{when}", formatWeekdayDateTime(match.startsAt))
    .replace("{division}", matchLevelLabel(match.division))
    .replace("{address}", addressLabel(match.address));
  const officials = officialsSummary(match.officials);
  return officials === null
    ? line
    : // Même paragraphe : un saut de ligne disparaîtrait dans un <p> HTML.
      `${line} — ${t.officialsLine.replace("{officials}", officials)}`;
}

type RecapTexts = { subject: string; title: string; countOne: string; countMany: string };

function buildRecapEmail(
  texts: RecapTexts,
  input: { email: string; date: string; matches: readonly WeekendMatch[]; appUrl: string },
): EmailMessage {
  const count = input.matches.length;
  const intro = count === 1 ? texts.countOne : texts.countMany.replace("{count}", String(count));
  const { text, html } = renderEmail({
    title: texts.title,
    paragraphs: [intro, ...input.matches.map(weekendMatchLine)],
    action: {
      label: t.action,
      url: `${input.appUrl}${UPCOMING_PATH}`,
      fallback: fr.email.linkFallback,
    },
    footer: fr.email.reminderFooter,
  });
  const subject = texts.subject.replace("{date}", formatShortDate(input.date));
  return { to: input.email, subject, text, html };
}

/** Récapitulatif du weekend. Le job n'appelle cette fonction que s'il y a des matchs. */
export function buildWeekendRecapEmail(input: WeekendRecapEmailInput): EmailMessage {
  return buildRecapEmail(t, { ...input, date: input.saturday });
}

export type WeekdayRecapEmailInput = Omit<WeekendRecapEmailInput, "saturday"> & {
  /** Lundi de la semaine récapitulée, `AAAA-MM-JJ`. */
  monday: string;
};

/** Récapitulatif des matchs du lundi au jeudi. Appelé seulement s'il y a des matchs. */
export function buildWeekdayRecapEmail(input: WeekdayRecapEmailInput): EmailMessage {
  return buildRecapEmail(tWeekday, { ...input, date: input.monday });
}
