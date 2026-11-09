import type { Metadata } from "next";
import Link from "next/link";
import { fr } from "@/i18n/fr";

const t = fr.notFound;

export const metadata: Metadata = {
  title: `${t.title} · ${fr.app.name}`,
  robots: { index: false, follow: false },
};

/**
 * Page « introuvable », pour une adresse inconnue comme pour `notFound()`. Le même
 * message couvre une ressource inexistante, supprimée ou d'un autre compte (§6.2).
 */
export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-16">
      <h1 className="text-2xl font-semibold">{t.title}</h1>
      <p className="text-muted-foreground">{t.body}</p>
      <Link href="/" className="inline-flex min-h-11 items-center self-start underline">
        {t.back}
      </Link>
    </main>
  );
}
