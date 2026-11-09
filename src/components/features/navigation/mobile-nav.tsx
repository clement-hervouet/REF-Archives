"use client";

/**
 * Barre d'onglets en bas de l'écran (téléphone, sous `md`) : pages principales et « Plus »,
 * qui ouvre un panneau avec les pages secondaires, l'administration, le compte et la
 * déconnexion. Seuls les onglets portent une icône (§3.12).
 */
import { CalendarClock, House, Menu, NotebookPen, Receipt, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { fr } from "@/i18n/fr";
import { cn } from "@/lib/utils";
import {
  ACCOUNT_NAV,
  ADMIN_NAV,
  PRIMARY_NAV,
  SECONDARY_NAV,
  isAnyNavItemActive,
  isNavItemActive,
} from "./nav-items";
import type { NavIcon, NavItem } from "./nav-items";
import type { NavUser } from "./nav-user";

const ICONS: Record<NavIcon, LucideIcon> = {
  home: House,
  upcoming: CalendarClock,
  compensations: Receipt,
  notes: NotebookPen,
};

type Props = {
  user: NavUser;
  logoutAction: () => Promise<void>;
};

const TAB_CLASS =
  "relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-xs text-muted-foreground";
// Repère de l'onglet actif : trait en haut ET graisse (jamais la couleur seule).
const TAB_ACTIVE_CLASS =
  "font-semibold text-foreground before:absolute before:inset-x-3 before:top-0 before:h-0.5 before:rounded-full before:bg-primary";

function Tab({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isNavItemActive(item, pathname);
  const Icon = item.icon === undefined ? null : ICONS[item.icon];
  return (
    <li className="flex flex-1">
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cn(TAB_CLASS, active && TAB_ACTIVE_CLASS)}
      >
        {Icon !== null && (
          <Icon aria-hidden="true" className="size-5" strokeWidth={active ? 2.25 : 1.75} />
        )}
        <span>{item.shortLabel ?? item.label}</span>
      </Link>
    </li>
  );
}

function PanelLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isNavItemActive(item, pathname);
  return (
    <li>
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex min-h-12 items-center rounded-md px-3 hover:bg-accent",
          active && "bg-accent font-semibold",
        )}
      >
        {item.label}
      </Link>
    </li>
  );
}

export function MobileNav({ user, logoutAction }: Props) {
  const pathname = usePathname();
  const panelId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  // Le panneau est lié à la page où il a été ouvert : naviguer le referme sans effet ni état
  // à remettre à zéro.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;

  const secondary = [...SECONDARY_NAV, ...(user.isAdmin ? ADMIN_NAV : []), ACCOUNT_NAV];
  const moreActive = isAnyNavItemActive(secondary, pathname);

  useEffect(() => {
    if (!open) {
      return;
    }
    panelRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenOn(null);
        moreButtonRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="md:hidden">
      {open && (
        <>
          <button
            type="button"
            aria-label={fr.nav.close}
            tabIndex={-1}
            onClick={() => {
              setOpenOn(null);
            }}
            className="fixed inset-0 z-40 cursor-default bg-overlay"
          />
          <div
            id={panelId}
            ref={panelRef}
            tabIndex={-1}
            aria-label={fr.nav.more}
            role="region"
            className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-50 flex max-h-[70dvh] flex-col gap-3 overflow-y-auto rounded-t-lg border-t border-border bg-background px-3 pt-4 pb-3 outline-none"
          >
            <div className="flex items-start justify-between gap-3 px-3">
              <div className="min-w-0">
                <p className="text-lg font-semibold [font-stretch:85%]">
                  {user.firstname} {user.lastname}
                </p>
                <p className="truncate text-sm text-muted-foreground">{user.email}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setOpenOn(null);
                  moreButtonRef.current?.focus();
                }}
                className="-mt-1 -mr-1 inline-flex size-11 shrink-0 items-center justify-center rounded-md hover:bg-accent"
              >
                <X aria-hidden="true" className="size-5" />
                <span className="sr-only">{fr.nav.close}</span>
              </button>
            </div>
            <ul className="flex flex-col">
              {SECONDARY_NAV.map((item) => (
                <PanelLink key={item.href} item={item} pathname={pathname} />
              ))}
            </ul>
            {user.isAdmin && (
              <div className="flex flex-col gap-1 border-t border-border pt-3">
                <p className="px-3 text-sm text-muted-foreground">{fr.nav.adminGroup}</p>
                <ul className="flex flex-col">
                  {ADMIN_NAV.map((item) => (
                    <PanelLink key={item.href} item={item} pathname={pathname} />
                  ))}
                </ul>
              </div>
            )}
            <div className="flex flex-col border-t border-border pt-3">
              <ul>
                <PanelLink item={ACCOUNT_NAV} pathname={pathname} />
              </ul>
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="flex min-h-12 w-full items-center rounded-md px-3 text-left hover:bg-accent"
                >
                  {fr.auth.logout}
                </button>
              </form>
            </div>
          </div>
        </>
      )}

      <nav
        aria-label={fr.nav.mainLabel}
        className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background pb-[env(safe-area-inset-bottom)]"
      >
        <ul className="flex">
          {PRIMARY_NAV.map((item) => (
            <Tab key={item.href} item={item} pathname={pathname} />
          ))}
          <li className="flex flex-1">
            <button
              ref={moreButtonRef}
              type="button"
              aria-expanded={open}
              aria-controls={open ? panelId : undefined}
              onClick={() => {
                setOpenOn(open ? null : pathname);
              }}
              className={cn(
                TAB_CLASS,
                // Repère « page courante » seulement si la page est dans le menu ; ouvert ≠ actif.
                moreActive && TAB_ACTIVE_CLASS,
                open && "bg-accent text-foreground",
              )}
            >
              <Menu aria-hidden="true" className="size-5" strokeWidth={moreActive ? 2.25 : 1.75} />
              <span>{fr.nav.more}</span>
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
}
