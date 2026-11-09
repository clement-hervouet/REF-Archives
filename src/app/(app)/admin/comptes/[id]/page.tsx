import Link from "next/link";
import { notFound } from "next/navigation";
import { AccountDetailsForm } from "@/components/features/accounts/account-details-form";
import {
  accountContentsLabel,
  accountName,
  accountStatus,
  accountTimeline,
} from "@/components/features/accounts/account-labels";
import { BlockForm } from "@/components/features/accounts/block-form";
import { DeletionForm } from "@/components/features/accounts/deletion-form";
import { PasswordLinkForm } from "@/components/features/accounts/password-link-form";
import { StatusBadge } from "@/components/features/common/status-badge";
import { SettingsSection } from "@/components/features/settings/settings-section";
import { fr } from "@/i18n/fr";
import { ACCOUNTS_PATH } from "@/lib/app-paths";
import { toParisIsoDate } from "@/lib/dates";
import { formatDateTime } from "@/lib/format";
import { requireAdminOrRedirect } from "@/server/auth/session";
import { accountSuspension } from "@/server/db/account-state";
import { findAccount } from "@/server/db/accounts";
import { getDb } from "@/server/db/pool";
import {
  blockAccountAction,
  cancelDeletionAction,
  scheduleDeletionAction,
  sendPasswordLinkAction,
  unblockAccountAction,
  updateAccountAction,
} from "../actions";

const t = fr.admin.accounts;
const s = t.sections;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY_MS = 24 * 60 * 60 * 1000;

type AccountPageProps = { params: Promise<{ id: string }> };

export default async function AccountPage(props: AccountPageProps) {
  // Page réservée aux admins : 404 pour un utilisateur simple (§6.2).
  const admin = await requireAdminOrRedirect();
  const { id } = await props.params;
  if (!UUID.test(id)) {
    notFound();
  }
  const account = await findAccount(getDb(), id);
  if (account === null) {
    notFound();
  }
  const now = new Date();
  const isSelf = account.id === admin.id;
  const name = accountName(account);
  const status = accountStatus(account, now);
  const suspension = accountSuspension(account.state, now);
  const deletionPending = account.state.deletionDueAt !== null;
  const currentBlock =
    suspension?.kind === "blocked"
      ? suspension.until === null
        ? s.block.currentIndefinite
        : s.block.current.replace("{date}", formatDateTime(suspension.until))
      : null;
  const contents = accountContentsLabel(account.contents);

  return (
    <div className="flex flex-col gap-6">
      <Link href={ACCOUNTS_PATH} className="inline-flex min-h-11 items-center self-start underline">
        {t.back}
      </Link>

      <header className="flex flex-col gap-3 rounded-md border border-border p-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold break-words">
            {name}
            {isSelf && (
              <span className="text-base font-normal text-muted-foreground"> ({t.you})</span>
            )}
          </h1>
          {name !== account.email && <p className="break-all">{account.email}</p>}
          <p className="text-sm text-muted-foreground">{accountTimeline(account)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {account.role === "admin" && <StatusBadge tone="neutral">{t.admin}</StatusBadge>}
          <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
        </div>
        {isSelf && <p className="text-sm text-muted-foreground">{t.selfNote}</p>}
      </header>

      <SettingsSection
        id="account-details"
        title={s.details.title}
        description={s.details.description}
      >
        <AccountDetailsForm
          action={updateAccountAction}
          isSelf={isSelf}
          account={{
            id: account.id,
            firstname: account.firstname ?? "",
            lastname: account.lastname ?? "",
            email: account.email,
            role: account.role,
          }}
        />
      </SettingsSection>

      <SettingsSection
        id="account-password"
        title={s.password.title}
        description={s.password.description}
      >
        <PasswordLinkForm
          action={sendPasswordLinkAction}
          accountId={account.id}
          disabled={deletionPending}
        />
      </SettingsSection>

      <SettingsSection id="account-block" title={s.block.title} description={s.block.description}>
        {isSelf ? (
          <p className="text-sm text-muted-foreground">{s.block.self}</p>
        ) : deletionPending ? (
          <p className="text-sm text-muted-foreground">{s.block.deletionPending}</p>
        ) : (
          <BlockForm
            blockAction={blockAccountAction}
            unblockAction={unblockAccountAction}
            accountId={account.id}
            current={currentBlock}
            minDate={toParisIsoDate(new Date(now.getTime() + DAY_MS))}
          />
        )}
      </SettingsSection>

      <SettingsSection
        id="account-deletion"
        title={s.deletion.title}
        description={
          <>
            <p>{s.deletion.description}</p>
            <p>
              {contents === null
                ? s.deletion.nothing
                : s.deletion.contents.replace("{contents}", contents)}
            </p>
          </>
        }
      >
        {isSelf ? (
          <p className="text-sm text-muted-foreground">{s.deletion.self}</p>
        ) : (
          <DeletionForm
            scheduleAction={scheduleDeletionAction}
            cancelAction={cancelDeletionAction}
            accountId={account.id}
            pendingDate={
              account.state.deletionDueAt === null
                ? null
                : formatDateTime(account.state.deletionDueAt)
            }
          />
        )}
      </SettingsSection>
    </div>
  );
}
