/**
 * Textes de la page admin « Comptes » (bloc 10) : nom affiché, statut (avec sa couleur),
 * ligne de dates, contenu effacé par une suppression. Purs.
 */
import type { StatusTone } from "@/components/features/common/status-badge";
import { fr } from "@/i18n/fr";
import { formatDateTime } from "@/lib/format";
import { searchText } from "@/lib/search";
import { accountSuspension } from "@/server/db/account-state";
import type { AccountContents, AccountSummary } from "@/server/db/accounts";

const t = fr.admin.accounts;

/** « Prénom Nom », ou l'email pour un compte créé avant le bloc 10 (sans nom). */
export function accountName(account: Pick<AccountSummary, "firstname" | "lastname" | "email">) {
  if (account.firstname === null || account.lastname === null) {
    return account.email;
  }
  return `${account.firstname} ${account.lastname}`;
}

export function accountSearchText(account: AccountSummary): string {
  return searchText([account.firstname, account.lastname, account.email]);
}

export type AccountStatusLabel = { tone: StatusTone; label: string; suspended: boolean };

/** Statut à l'instant `now` : actif (vert), bloqué (jaune avec date, rouge sans fin), suppression (rouge). */
export function accountStatus(account: AccountSummary, now: Date): AccountStatusLabel {
  const suspension = accountSuspension(account.state, now);
  if (suspension === null) {
    return { tone: "success", label: t.status.active, suspended: false };
  }
  if (suspension.kind === "deletion") {
    return {
      tone: "danger",
      label: t.status.deletion.replace("{date}", formatDateTime(suspension.dueAt)),
      suspended: true,
    };
  }
  return suspension.until === null
    ? { tone: "danger", label: t.status.blocked, suspended: true }
    : {
        tone: "warning",
        label: t.status.blockedUntil.replace("{date}", formatDateTime(suspension.until)),
        suspended: true,
      };
}

/** « Créé le … · dernière activité le … » (ou « jamais connecté »). */
export function accountTimeline(account: AccountSummary): string {
  const created = t.createdOn.replace("{date}", formatDateTime(account.createdAt));
  const seen =
    account.lastSeenAt === null
      ? t.neverSeen
      : t.lastSeen.replace("{date}", formatDateTime(account.lastSeenAt));
  return `${created} · ${seen}`;
}

const CONTENT_KEYS: readonly (keyof AccountContents)[] = [
  "compensations",
  "games",
  "notes",
  "scales",
  "colleagues",
];

/** « 12 indemnités, 1 match, 3 collègues » (types vides omis) ; `null` si rien. */
export function accountContentsLabel(contents: AccountContents): string | null {
  const parts = CONTENT_KEYS.filter((key) => contents[key] > 0).map((key) => {
    const [one, many] = t.contents[key];
    return (contents[key] === 1 ? one : many).replace("{count}", String(contents[key]));
  });
  return parts.length === 0 ? null : parts.join(", ");
}

/** « 2 comptes coupés » ; `null` si aucun. */
export function suspendedCountLabel(count: number): string | null {
  if (count === 0) return null;
  return count === 1
    ? t.summary.suspendedOne
    : t.summary.suspendedMany.replace("{count}", String(count));
}
