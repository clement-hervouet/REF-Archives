/**
 * Message affiché après une action sur le lien d'abonnement. Pur et sans React.
 */
import type { ScaleMessage } from "@/components/features/scales/scale-messages";
import { fr } from "@/i18n/fr";
import type { CalendarFeedState } from "@/server/calendar/manage-feed";

const t = fr.calendar.settings;

export function calendarFeedMessage(status: CalendarFeedState["status"]): ScaleMessage | null {
  switch (status) {
    case "idle":
      return null;
    case "created":
      return { tone: "success", text: t.created };
    case "revoked":
      return { tone: "success", text: t.revoked };
    case "invalid":
      return { tone: "error", text: t.errors.invalid };
    case "not_found":
      return { tone: "error", text: t.errors.notFound };
  }
}
