import { ColleagueForm } from "@/components/features/games/colleague-form";
import { ConfirmActionButton } from "@/components/features/games/confirm-action-button";
import { personLabel } from "@/components/features/games/person-label";
import { fr } from "@/i18n/fr";
import { requireUserOrRedirect } from "@/server/auth/session";
import { listColleagues } from "@/server/db/persons";
import { getDb } from "@/server/db/pool";
import { createColleagueAction, deleteColleagueAction, updateColleagueAction } from "./actions";

const t = fr.colleagues;

export default async function ColleaguesPage() {
  // Chaque page vérifie elle-même (§6.2) : le layout n'est pas rendu à chaque navigation.
  const user = await requireUserOrRedirect();
  const colleagues = await listColleagues(getDb(), user.id);

  return (
    <div className="flex flex-col gap-8">
      <section className="flex max-w-2xl flex-col gap-2">
        <h1 className="text-2xl font-semibold">{t.title}</h1>
        <p className="text-neutral-700">{t.intro}</p>
      </section>

      <section className="flex flex-col gap-3 rounded-md border border-neutral-300 p-4">
        <h2 className="text-lg font-semibold">{t.add.legend}</h2>
        <ColleagueForm
          action={createColleagueAction}
          labels={{ submit: t.add.submit, submitting: t.add.submitting }}
        />
      </section>

      {colleagues.length === 0 ? (
        <p>{t.empty}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {colleagues.map((colleague) => {
            const name = personLabel(colleague);
            return (
              <li key={colleague.id}>
                <article className="flex flex-col gap-3 rounded-md border border-neutral-300 p-4">
                  <h2 className="font-semibold break-words">
                    {name}
                    {colleague.hasAccount && (
                      <span className="ml-2 text-sm font-normal text-neutral-700">
                        ({fr.games.officials.hasAccountBadge})
                      </span>
                    )}
                  </h2>
                  <ColleagueForm
                    action={updateColleagueAction}
                    initialValues={{
                      personId: colleague.id,
                      lastname: colleague.lastname,
                      firstname: colleague.firstname ?? "",
                      hasAccount: colleague.hasAccount ? "on" : "",
                    }}
                    labels={{
                      submit: t.edit.submit,
                      submitting: t.edit.submitting,
                      ariaLabel: t.edit.label.replace("{name}", name),
                    }}
                  />
                  <ConfirmActionButton
                    action={deleteColleagueAction}
                    hidden={{ name: "personId", value: colleague.id }}
                    labels={{
                      submit: t.delete.submit,
                      ariaLabel: t.delete.label.replace("{name}", name),
                      warning: t.delete.warning,
                      confirm: t.delete.confirm,
                      cancel: t.delete.cancel,
                    }}
                    messages={{ in_use: t.delete.inUse, not_found: t.errors.notFound }}
                  />
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
