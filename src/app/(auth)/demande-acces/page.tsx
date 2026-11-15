import type { Metadata } from "next";
import { AppBrand } from "@/components/features/common/app-brand";
import { PageTitle } from "@/components/features/common/page-title";
import { fr } from "@/i18n/fr";
import { AccessRequestForm } from "./access-request-form";

export const metadata: Metadata = { title: fr.accessRequest.title };

/** Page publique « Demander un accès » (§15.4.4), ouverte depuis la page de connexion. */
export default function AccessRequestPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 p-6">
      <AppBrand />
      <PageTitle>{fr.accessRequest.title}</PageTitle>
      <AccessRequestForm />
    </main>
  );
}
