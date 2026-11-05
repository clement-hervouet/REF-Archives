/**
 * Branchement du flux iCal sur la vraie base (voir `feed-response.ts`).
 */
import { findUserIdByCalendarToken } from "../db/calendar-feeds";
import { listCalendarMatchesSince } from "../db/calendar-matches";
import { getDb } from "../db/pool";
import type { CalendarFeedDeps } from "./feed-response";

export function createCalendarFeedDeps(): CalendarFeedDeps {
  const db = getDb();
  return {
    findUserIdByTokenHash: (tokenHash) => findUserIdByCalendarToken(db, tokenHash),
    listMatchesSince: (input) => listCalendarMatchesSince(db, input),
  };
}
