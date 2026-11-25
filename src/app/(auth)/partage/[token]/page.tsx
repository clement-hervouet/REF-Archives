import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppBrand } from "@/components/features/common/app-brand";
import { PageTitle } from "@/components/features/common/page-title";
import { personLabel } from "@/components/features/games/person-label";
import { fullNameOf } from "@/components/features/games/shared-preparation-labels";
import { fr } from "@/i18n/fr";
import { COMPLETE_PROFILE_PATH, PRIVACY_PATH } from "@/lib/app-paths";
import { toParisIsoDate } from "@/lib/dates";
import { formatIsoDate } from "@/lib/format";
import { withTeams } from "@/lib/match-teams";
import { tokenSchema } from "@/lib/schemas/auth";
import { hasCompleteProfile } from "@/server/auth/current-user";
import { getCurrentUser } from "@/server/auth/session";
import { hashToken } from "@/server/auth/tokens";
import { listOwnerLinks } from "@/server/db/colleague-links";
import { listColleagues } from "@/server/db/persons";
import { getDb } from "@/server/db/pool";
import { findShareLinkPreview } from "@/server/db/shared-preparations";
import { AcceptShareForm } from "./accept-share-form";

const t = fr.sharing.accept;

// Le jeton est dans l'URL : on évite qu'il fuite par le Referer et qu'une page soit indexée.
export const metadata: Metadata = {
  title: t.title,
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

type SharePageProps = { params: Promise<{ token: string }> };

/** Lire `params` et la session est une donnée de requête : ce composant reste sous <Suspense>. */
async function ShareContent({ params }: SharePageProps) {
  const parsed = tokenSchema.safeParse((await params).token);
  // Même message pour un lien mal formé, inconnu, expiré, utilisé ou révoqué (§6.1).
  if (!parsed.success) {
    return <p role="alert">{t.invalid}</p>;
  }
  const user = await getCurrentUser();
  if (user === null) {
    // Après la connexion, la page de connexion ramène ici (`?partage=`, jeton revérifié).
    return (
      <div className="flex flex-col gap-3">
        <p>{t.signIn}</p>
        <Link
          href={`/login?partage=${parsed.data}`}
          className="inline-flex min-h-11 items-center self-start rounded-md border border-input px-4"
        >
          {t.signInLink}
        </Link>
      </div>
    );
  }
  if (!hasCompleteProfile(user)) {
    redirect(COMPLETE_PROFILE_PATH);
  }
  const db = getDb();
  const preview = await findShareLinkPreview(db, hashToken(parsed.data));
  if (preview === null) {
    return <p role="alert">{t.invalid}</p>;
  }
  if (preview.owner.userId === user.id) {
    return <p role="status">{t.own}</p>;
  }
  const ownerName = fullNameOf(preview.owner);
  const [colleagues, links] = await Promise.all([
    listColleagues(db, user.id),
    listOwnerLinks(db, user.id),
  ]);
  // Propriétaire déjà parmi ses collègues liés : rien à proposer. Sinon, ses fiches pas
  // encore liées ; une fiche au même nom est proposée d'office.
  const alreadyLinked = [...links.values()].some((link) => link.userId === preview.owner.userId);
  const free = colleagues.filter((colleague) => !links.has(colleague.id));
  const sameName = free.find(
    (colleague) =>
      colleague.lastname.toLowerCase() === (preview.owner.lastname ?? "").toLowerCase() &&
      (colleague.firstname === null ||
        colleague.firstname.toLowerCase() === (preview.owner.firstname ?? "").toLowerCase()),
  );
  const date = formatIsoDate(toParisIsoDate(preview.startsAt));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <p>{t.intro.replace("{name}", ownerName)}</p>
        <p className="font-semibold">
          {withTeams(fr.preparations.teams, preview.team1Name, preview.team2Name)} · {date}
        </p>
      </div>
      <AcceptShareForm
        token={parsed.data}
        ownerName={ownerName}
        colleagues={
          alreadyLinked
            ? null
            : free.map((colleague) => ({ id: colleague.id, name: personLabel(colleague) }))
        }
        defaultReverse={sameName?.id ?? "create"}
      />
    </div>
  );
}

export default function SharePage({ params }: SharePageProps) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 p-6">
      <AppBrand />
      <PageTitle>{t.title}</PageTitle>
      <Suspense fallback={null}>
        <ShareContent params={params} />
      </Suspense>
      <Link
        href={PRIVACY_PATH}
        className="inline-flex min-h-11 items-center self-start text-sm text-muted-foreground underline"
      >
        {fr.privacy.link}
      </Link>
    </main>
  );
}
