/**
 * Titre principal d'une page (`<h1>`), style commun à toutes les pages (bloc 13).
 * `className` permet un ajustement ponctuel (ex. `break-words`).
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h1 className={cn("text-2xl font-semibold", className)}>{children}</h1>;
}
