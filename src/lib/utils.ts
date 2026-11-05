/**
 * Utilitaire attendu par les composants shadcn/ui (`@/lib/utils`, voir components.json).
 */
import { clsx } from "clsx";
import type { ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Assemble des classes Tailwind ; en cas de conflit (`px-2` puis `px-4`), la dernière gagne.
 * Sert à surcharger les classes par défaut d'un composant depuis l'appelant.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
