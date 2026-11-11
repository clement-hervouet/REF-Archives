/**
 * Purge planifiée des comptes (bloc 10) : efface définitivement ceux dont la suppression,
 * demandée par un admin, est due (un mois après la demande). Idempotent : un second
 * passage ne trouve rien. Appelée chaque jour par la route `/api/cron/purge-accounts`.
 */
import { purgeDueAccounts } from "../db/accounts";
import type { Transaction } from "../db/users";

export type PurgeAccountsDeps = {
  transaction: Transaction;
  /** Journal : un événement par compte effacé, anonyme (le compte n'existe plus). */
  recordDeleted: () => Promise<void>;
};

export async function runPurgeAccounts(deps: PurgeAccountsDeps): Promise<{ deleted: number }> {
  const ids = await deps.transaction((db) => purgeDueAccounts(db));
  for (let index = 0; index < ids.length; index += 1) {
    await deps.recordDeleted();
  }
  return { deleted: ids.length };
}
