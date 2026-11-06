/**
 * Section de la page « Paramètres » (bloc 10) : titre et explication à gauche, réglages à
 * droite sur grand écran ; empilés sur mobile. Un filet sépare les sections.
 */
import type { ReactNode } from "react";

type Props = {
  id: string;
  title: string;
  description?: ReactNode;
  children: ReactNode;
};

export function SettingsSection({ id, title, description, children }: Props) {
  return (
    <section
      aria-labelledby={id}
      className="grid gap-4 border-t border-border pt-6 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-10"
    >
      <div className="flex flex-col gap-1">
        <h2 id={id} className="text-lg font-semibold">
          {title}
        </h2>
        {description !== undefined && (
          <div className="flex flex-col gap-2 text-sm text-muted-foreground">{description}</div>
        )}
      </div>
      <div className="flex min-w-0 max-w-2xl flex-col gap-4">{children}</div>
    </section>
  );
}
