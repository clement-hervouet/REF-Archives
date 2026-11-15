import type { Metadata } from "next";
import Link from "next/link";
import { AppBrand } from "@/components/features/common/app-brand";
import { PageTitle } from "@/components/features/common/page-title";
import { fr } from "@/i18n/fr";

const t = fr.privacy;

export const metadata: Metadata = { title: t.title };

/**
 * Page « Confidentialité » (§15.4.3) : information RGPD (art. 13), publique pour être lue
 * avant de créer son compte. Texte seul, sans donnée de la base ni lecture de session : la
 * même page pour tout le monde. Le lien de retour mène à l'accueil, que le proxy renvoie
 * vers la connexion pour un visiteur sans session.
 */
export default function PrivacyPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-6 p-6">
      <AppBrand />
      <div className="flex flex-col gap-1">
        <PageTitle>{t.title}</PageTitle>
        <p className="text-sm text-muted-foreground">{t.updated}</p>
      </div>
      <p>{t.intro}</p>

      {t.sections.map((section) => (
        <section
          key={section.id}
          aria-labelledby={section.id}
          className="flex flex-col gap-3 border-t border-border pt-6"
        >
          <h2 id={section.id} className="text-lg font-semibold">
            {section.title}
          </h2>
          {section.items.length > 0 && (
            <ul className="flex list-disc flex-col gap-2 pl-5">
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </section>
      ))}

      <Link
        href="/"
        className="inline-flex min-h-11 items-center self-start text-sm underline"
      >
        {t.back}
      </Link>
    </main>
  );
}
