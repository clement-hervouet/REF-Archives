"use client";

/**
 * Barre latérale fixe (ordinateur, à partir de `md`). Prénom en haut, pages principales,
 * pages secondaires, administration (admins), compte et déconnexion en bas.
 * Client seulement pour connaître la page affichée (`usePathname`).
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { fr } from "@/i18n/fr";
import { cn } from "@/lib/utils";
import { ACCOUNT_NAV, ADMIN_NAV, PRIMARY_NAV, SECONDARY_NAV, isNavItemActive } from "./nav-items";
import type { NavItem } from "./nav-items";
import type { NavUser } from "./nav-user";

type Props = {
  user: NavUser;
  logoutAction: () => Promise<void>;
};

function SidebarLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isNavItemActive(item, pathname);
  return (
    <li>
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          // Repère de la page affichée : barre jaune à gauche ET graisse (jamais la couleur seule).
          "relative flex min-h-11 items-center rounded-md px-3 text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground",
          active &&
            "bg-sidebar-accent font-semibold text-sidebar-foreground before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-full before:bg-warning",
        )}
      >
        {item.label}
      </Link>
    </li>
  );
}

function SidebarGroup({
  label,
  items,
  pathname,
}: {
  label?: string;
  items: readonly NavItem[];
  pathname: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      {label !== undefined && (
        <p className="px-3 pt-2 text-sm text-sidebar-muted" id={`nav-${label}`}>
          {label}
        </p>
      )}
      <ul
        className="flex flex-col gap-0.5"
        aria-labelledby={label === undefined ? undefined : `nav-${label}`}
      >
        {items.map((item) => (
          <SidebarLink key={item.href} item={item} pathname={pathname} />
        ))}
      </ul>
    </div>
  );
}

export function Sidebar({ user, logoutAction }: Props) {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-sidebar text-sidebar-foreground md:flex">
      <div className="flex flex-col gap-1 px-5 pt-6 pb-5">
        <Link
          href="/"
          className="self-start text-sm text-sidebar-muted hover:text-sidebar-foreground"
        >
          {fr.app.name}
        </Link>
        <p className="text-2xl leading-tight font-semibold [font-stretch:85%]">{user.firstname}</p>
      </div>

      <nav
        aria-label={fr.nav.mainLabel}
        className="flex flex-1 flex-col gap-4 overflow-y-auto px-2"
      >
        <SidebarGroup items={PRIMARY_NAV} pathname={pathname} />
        <div className="mx-3 border-t border-sidebar-border" />
        <SidebarGroup items={SECONDARY_NAV} pathname={pathname} />
        {user.isAdmin && (
          <SidebarGroup label={fr.nav.adminGroup} items={ADMIN_NAV} pathname={pathname} />
        )}
      </nav>

      <div className="flex flex-col gap-1 border-t border-sidebar-border px-2 py-3">
        <ul>
          <SidebarLink item={ACCOUNT_NAV} pathname={pathname} />
        </ul>
        <p className="truncate px-3 text-sm text-sidebar-muted" title={user.email}>
          {user.email}
        </p>
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex min-h-11 w-full items-center rounded-md px-3 text-left text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            {fr.auth.logout}
          </button>
        </form>
      </div>
    </aside>
  );
}
