/**
 * Logo de REF-Archives : le sifflet de l'icône de l'application (`src/app/icon.svg`),
 * dessiné en ligne pour suivre le thème.
 * - `tile` : la tuile bleu marine de l'icône, sifflet blanc (pages hors connexion, fond clair
 *   ou sombre) ;
 * - sinon le sifflet seul, de la couleur du texte (`currentColor`), pour un fond déjà coloré
 *   comme la barre latérale.
 * Décoratif : le nom de l'application est toujours écrit à côté.
 */
import { cn } from "@/lib/utils";

type Props = {
  tile?: boolean;
  className?: string;
};

function Whistle({ stroke, fill }: { stroke: string; fill: string }) {
  return (
    <g fill="none" stroke={stroke} strokeWidth="17" strokeLinejoin="round">
      <circle cx="80.44" cy="128" r="59.56" />
      <path d="M80.44,68.44h81.31L168,76.53h25.25L199,68.44h49v32.34c-48,2.7-86.43,25.79-118.91,61.58" />
      <circle cx="80.43" cy="127.99" r="24" fill={fill} stroke="none" />
    </g>
  );
}

export function AppLogo({ tile = false, className }: Props) {
  if (tile) {
    return (
      <svg
        viewBox="0 0 32 32"
        aria-hidden="true"
        focusable="false"
        className={cn("shrink-0", className)}
      >
        <rect width="32" height="32" rx="5.76" fill="#08335b" />
        <g transform="translate(1.051 1.051) scale(0.11679)">
          <Whistle stroke="#ffffff" fill="#ffffff" />
        </g>
      </svg>
    );
  }
  return (
    <svg
      viewBox="0 0 256 256"
      aria-hidden="true"
      focusable="false"
      className={cn("shrink-0", className)}
    >
      <Whistle stroke="currentColor" fill="currentColor" />
    </svg>
  );
}
