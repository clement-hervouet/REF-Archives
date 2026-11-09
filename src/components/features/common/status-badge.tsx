/**
 * Badge de statut (bloc 10) : pastille colorée et texte, jamais la couleur seule. Le vert
 * et le jaune teintent le fond et la pastille, pas le texte (§3.12). Utilisé par les
 * invitations et les comptes.
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type StatusTone = "success" | "warning" | "danger" | "neutral";

const STYLES: Record<StatusTone, { badge: string; dot: string }> = {
  success: { badge: "border-success/50 bg-success/15", dot: "bg-success" },
  warning: { badge: "border-warning/60 bg-warning/15", dot: "bg-warning" },
  danger: { badge: "border-destructive/50 bg-destructive/10", dot: "bg-destructive" },
  neutral: { badge: "border-border bg-muted", dot: "bg-muted-foreground" },
};

export function StatusBadge({ tone, children }: { tone: StatusTone; children: ReactNode }) {
  const style = STYLES[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-sm font-medium whitespace-nowrap",
        style.badge,
      )}
    >
      <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", style.dot)} />
      {children}
    </span>
  );
}
