import Link from "next/link";
import {
  accountName,
  accountSearchText,
  accountStatus,
  accountTimeline,
  suspendedCountLabel,
} from "@/components/features/accounts/account-labels";
import { SearchableList } from "@/components/features/common/searchable-list";
import { StatusBadge } from "@/components/features/common/status-badge";
import { fr } from "@/i18n/fr";
import { accountPath } from "@/lib/app-paths";
import { requireAdminOrRedirect } from "@/server/auth/session";
import { listAccounts } from "@/server/db/accounts";
import type { AccountSummary } from "@/server/db/accounts";
import { getDb } from "@/server/db/pool";

const t = fr.admin.accounts;

function AccountRow({
  account,
  isSelf,
  now,
}: {
  account: AccountSummary;
  isSelf: boolean;
  now: Date;
}) {
  const name = accountName(account);
  const status = accountStatus(account, now);
  return (
    // `relative` : le lien du nom couvre toute la carte (cible tactile, bloc 13).
    <article className="relative grid items-center gap-x-4 gap-y-2 rounded-md border border-border p-3 sm:grid-cols-[minmax(0,1fr)_auto]">
      <div className="flex min-w-0 flex-col gap-0.5">
        <h2 className="font-semibold break-words">
          <Link
            href={accountPath(account.id)}
            aria-label={t.open.replace("{name}", name)}
            className="underline decoration-border underline-offset-4 after:absolute after:inset-0 after:rounded-md hover:decoration-foreground"
          >
            {name}
          </Link>
          {isSelf && <span className="text-sm font-normal text-muted-foreground"> ({t.you})</span>}
        </h2>
        {name !== account.email && <p className="text-sm break-all">{account.email}</p>}
        <p className="text-sm text-muted-foreground">{accountTimeline(account)}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        {account.role === "admin" && <StatusBadge tone="neutral">{t.admin}</StatusBadge>}
        <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
      </div>
    </article>
  );
}

export default async function AccountsPage() {
  // Page réservée aux admins : 404 pour un utilisateur simple (§6.2).
  const admin = await requireAdminOrRedirect();
  const accounts = await listAccounts(getDb());
  const now = new Date();
  const suspended = suspendedCountLabel(
    accounts.filter((account) => accountStatus(account, now).suspended).length,
  );

  return (
    <div className="flex flex-col gap-6">
      <section className="flex max-w-2xl flex-col gap-2">
        <h1 className="text-2xl font-semibold">{t.title}</h1>
        <p className="text-muted-foreground">{t.intro}</p>
        {suspended !== null && <p className="text-sm font-medium">{suspended}</p>}
      </section>
      {accounts.length === 0 ? (
        <p className="text-muted-foreground">{t.empty}</p>
      ) : (
        <SearchableList
          layout="list"
          labels={t.search}
          entries={accounts.map((account) => ({
            id: account.id,
            searchText: accountSearchText(account),
            card: <AccountRow account={account} isSelf={account.id === admin.id} now={now} />,
          }))}
        />
      )}
    </div>
  );
}
