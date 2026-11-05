import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { logout } from "@/app/(app)/actions";
import { ProfileForm } from "@/components/features/account/profile-form";
import { SECONDARY_BUTTON_CLASS } from "@/components/features/scales/form-parts";
import { fr } from "@/i18n/fr";
import { hasCompleteProfile } from "@/server/auth/current-user";
import { requireSignedInOrRedirect } from "@/server/auth/session";
import { completeProfileAction } from "./actions";

const t = fr.profile.complete;

export const metadata: Metadata = { title: t.title };

/**
 * Passage obligé des comptes sans nom ni prénom (créés avant le bloc 10, ou premier admin) :
 * toutes les autres pages y redirigent tant que le profil est incomplet (§3.12).
 */
export default async function CompleteProfilePage() {
  const user = await requireSignedInOrRedirect();
  if (hasCompleteProfile(user)) {
    redirect("/");
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">{t.title}</h1>
        <p className="text-neutral-700">{t.intro}</p>
      </div>
      <ProfileForm
        profile={{ firstname: user.firstname ?? "", lastname: user.lastname ?? "" }}
        action={completeProfileAction}
        submitLabel={t.submit}
        submittingLabel={t.submitting}
      />
      <form action={logout}>
        <button type="submit" className={SECONDARY_BUTTON_CLASS}>
          {fr.auth.logout}
        </button>
      </form>
    </main>
  );
}
