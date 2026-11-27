"use client";

/**
 * Pastille d'un club (à l'essai sur les indemnités) : son logo FFBB, détouré et rogné, qui
 * remplit la pastille sur un fond blanc (dans les deux thèmes : les logos sont dessinés pour
 * le blanc), avec une petite marge s'il est large (le cercle en couperait les côtés) ; si le logo manque ou ne se charge pas, ses initiales sur la couleur du club
 * (couleur neutre du thème sans couleur connue). Décorative (`aria-hidden`) : le nom
 * du club est toujours écrit à côté.
 *
 * La CSP interdit les attributs `style` : la couleur du club est peinte par un SVG
 * (`fill`, attribut de présentation), et le texte prend une classe claire ou sombre.
 */
import { useEffect, useRef, useState } from "react";
import { clubLogoPath } from "@/lib/app-paths";
import { clubInitials, initialsTone } from "@/lib/club-badge";
import { cn } from "@/lib/utils";

/** Ce qu'il faut pour dessiner la pastille d'un club. */
export type ClubBadgeData = {
  id: string;
  name: string;
  /** Couleur du club `#rrggbb` (FFBB), `null` si inconnue. */
  color: string | null;
  /** Logo FFBB du club, `null` s'il n'en a pas. */
  logoUuid: string | null;
};

type Props = { club: ClubBadgeData; className?: string };

/** Logo plus large que haut de ce rapport : une petite marge évite que le cercle le coupe. */
const WIDE_RATIO = 1.2;

function isWide(image: HTMLImageElement): boolean {
  return image.naturalWidth > image.naturalHeight * WIDE_RATIO;
}

const TONE_CLASS = {
  light: "text-white",
  dark: "text-neutral-950",
} as const;

export function ClubBadge({ club, className }: Props) {
  // Logo qui n'a pas pu se charger : un autre logo (lien changé) est retenté.
  const [failedUuid, setFailedUuid] = useState<string | null>(null);
  // Logo large (lu au chargement), retenu par son UUID comme l'échec.
  const [wideUuid, setWideUuid] = useState<string | null>(null);
  const image = useRef<HTMLImageElement>(null);
  const showLogo = club.logoUuid !== null && club.logoUuid !== failedUuid;
  // La couleur du club ne sert que de fond aux initiales.
  const tone = showLogo ? null : initialsTone(club.color);

  // Une erreur survenue avant l'hydratation n'atteint pas `onError` : on la relit ici.
  useEffect(() => {
    const element = image.current;
    if (element === null || !element.complete) {
      return;
    }
    if (element.naturalWidth === 0) {
      setFailedUuid(club.logoUuid);
    } else if (isWide(element)) {
      setWideUuid(club.logoUuid);
    }
  }, [club.logoUuid]);

  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative inline-flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border",
        showLogo && "bg-white",
        !showLogo && tone === null && "bg-muted text-muted-foreground",
        className,
      )}
    >
      {tone !== null && club.color !== null && (
        <svg viewBox="0 0 1 1" className="absolute inset-0 size-full" focusable="false">
          <rect width="1" height="1" fill={club.color} />
        </svg>
      )}
      {showLogo && club.logoUuid !== null ? (
        // Logo servi par l'application (déjà redimensionné) : pas d'optimisation Next.js.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={image}
          src={clubLogoPath(club.id, club.logoUuid)}
          alt=""
          width={40}
          height={40}
          loading="lazy"
          decoding="async"
          onLoad={(event) => {
            if (isWide(event.currentTarget)) {
              setWideUuid(club.logoUuid);
            }
          }}
          onError={() => {
            setFailedUuid(club.logoUuid);
          }}
          className={cn(
            "relative size-full object-contain",
            wideUuid === club.logoUuid && "p-[3px]",
          )}
        />
      ) : (
        <span
          className={cn(
            "relative text-xs font-semibold tracking-tight",
            tone !== null && TONE_CLASS[tone],
          )}
        >
          {clubInitials(club.name)}
        </span>
      )}
    </span>
  );
}

/**
 * Pastilles des deux clubs d'un match, légèrement superposées, à placer devant le titre
 * « Équipe 1 – Équipe 2 ». Un plateau n'en a qu'une (club organisateur seul, §15.4.7).
 */
export function MatchClubBadges({
  team1,
  team2,
}: {
  team1: ClubBadgeData;
  team2: ClubBadgeData | null;
}) {
  return (
    <span className="flex shrink-0 -space-x-2">
      <ClubBadge club={team1} />
      {team2 !== null && <ClubBadge club={team2} className="ring-2 ring-background" />}
    </span>
  );
}
