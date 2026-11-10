"use client";

/**
 * Montre le résultat d'un envoi dans un formulaire long (bloc 13). Le bouton est en bas et
 * le message en haut : sans ce composant, l'utilisateur restait au bouton sans voir ni le
 * succès ni l'erreur. Après chaque envoi (`submission` change) :
 * - un champ en erreur reçoit le focus (le premier `aria-invalid`) : le lecteur d'écran
 *   annonce son erreur, et le navigateur l'amène à l'écran (au-dessus de la barre d'onglets
 *   grâce au `scroll-padding` de `globals.css`) ;
 * - sinon, le message (`data-form-message`, posé par `FormMessage`) est ramené à l'écran
 *   s'il n'y est pas déjà. Il est déjà annoncé par son rôle (`status` ou `alert`).
 */
import { useEffect, useRef, type ReactNode } from "react";

type Props = {
  /** Numéro d'envoi (`formKey` de `useScaleForm`) : 0 avant le premier envoi. */
  submission: number;
  children: ReactNode;
  className?: string;
};

function isInViewport(element: HTMLElement): boolean {
  const { top, bottom } = element.getBoundingClientRect();
  return top >= 0 && bottom <= window.innerHeight;
}

export function RevealResult({ submission, children, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (submission === 0 || root === null) {
      return;
    }
    const invalid = root.querySelector<HTMLElement>('[aria-invalid="true"]');
    if (invalid !== null) {
      invalid.focus();
      return;
    }
    const message = root.querySelector<HTMLElement>("[data-form-message]");
    if (message !== null && !isInViewport(message)) {
      message.scrollIntoView({ block: "center" });
    }
  }, [submission]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
