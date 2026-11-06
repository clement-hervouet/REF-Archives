"use client";

/**
 * Menu « Plus d'actions » d'une indemnité (bloc 10) : bouton qui ouvre une liste d'actions
 * (agenda, match, annulation du paiement, suppression). Se ferme avec Échap (le focus
 * revient au bouton), en cliquant ailleurs, ou en choisissant un élément marqué
 * `data-close-menu`. Simple divulgation, pas un `role="menu"` : on navigue avec Tab.
 */
import { Ellipsis } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  /** Étiquette accessible complète, ex. « Plus d'actions pour le match du 14/11/2026 ». */
  ariaLabel: string;
  children: ReactNode;
};

/**
 * Bouton discret (icône seule, sans bordure) : l'étiquette accessible et l'infobulle
 * (`title`) disent ce qu'il fait.
 */
export function ActionsMenu({ ariaLabel, children }: Props) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onPointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    // Sur téléphone, le panneau se place par rapport à la carte (ancêtre `relative`) et en
    // prend la largeur : ancré au bouton, il sortait de l'écran. Sur ordinateur, sous le bouton.
    <div ref={rootRef} className="md:relative">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={ariaLabel}
        title={ariaLabel}
        onClick={() => {
          setOpen((value) => !value);
        }}
        className={cn(
          "inline-flex size-11 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground",
          open && "bg-accent text-foreground",
        )}
      >
        <Ellipsis aria-hidden="true" className="size-5" />
      </button>
      {open && (
        <div
          id={panelId}
          onClick={(event) => {
            if (event.target instanceof Element && event.target.closest("[data-close-menu]")) {
              setOpen(false);
            }
          }}
          className="absolute inset-x-2 top-full z-20 -mt-2 flex flex-col gap-0.5 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-sm md:inset-x-auto md:right-0 md:mt-1 md:w-72"
        >
          {children}
        </div>
      )}
    </div>
  );
}
