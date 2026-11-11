import type { Metadata } from "next";
import { PageTitle } from "@/components/features/common/page-title";
import { fr } from "@/i18n/fr";
import { ForgotPasswordForm } from "./forgot-password-form";
import { AppBrand } from "@/components/features/common/app-brand";

export const metadata: Metadata = { title: fr.forgotPassword.title };

export default function ForgotPasswordPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 p-6">
      <AppBrand />
      <PageTitle>{fr.forgotPassword.title}</PageTitle>
      <ForgotPasswordForm />
    </main>
  );
}
