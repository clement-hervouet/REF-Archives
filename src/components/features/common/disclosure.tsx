/**
 * Panneau repliable (bloc 10) : un bouton à la taille de son texte, suivi d'un chevron, qui
 * ouvre un panneau pleine largeur juste en dessous. `<details>` natif : clavier, lecteurs
 * d'écran et fonctionnement sans JavaScript. Sert aux filtres des notes et aux formulaires
 * des barèmes. Ne pas imbriquer : le chevron suit le `<details>` ouvert le plus proche.
 */
import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  summary: ReactNode;
  open?: boolean;
  /** Classes du `<details>` (par exemple `open:basis-full` dans une rangée de boutons). */
  className?: string;
  children: ReactNode;
};

export function Disclosure({ summary, open = false, className, children }: Props) {
  return (
    <details open={open} className={cn("group/disclosure flex min-w-0 flex-col", className)}>
      <summary className="inline-flex min-h-11 w-fit cursor-pointer list-none items-center gap-2 rounded-md border border-input px-4 font-medium select-none hover:bg-accent [&::-webkit-details-marker]:hidden">
        {summary}
        <ChevronDown
          aria-hidden="true"
          className="size-4 shrink-0 transition-transform group-open/disclosure:rotate-180 motion-reduce:transition-none"
        />
      </summary>
      <div className="mt-3 rounded-md border border-border p-4">{children}</div>
    </details>
  );
}
