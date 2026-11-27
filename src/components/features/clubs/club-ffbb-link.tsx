"use client";

/**
 * Lien d'un club existant avec l'annuaire FFBB (onglet « Clubs ») : pour afficher le logo
 * d'un club saisi avant l'annuaire, on le retrouve par sa ville et on le lie. Seuls
 * l'identifiant FFBB, le logo et la couleur sont enregistrés : le nom et les salles du
 * club ne changent pas. Une fois lié, le club le reste : plus rien ici (la pastille de la
 * carte porte la marque « FFBB »), pas de bouton pour retirer le lien.
 */
import { useState, useTransition } from "react";
import { setClubFfbbLinkAction } from "@/app/(app)/clubs/ffbb-actions";
import { fr } from "@/i18n/fr";
import type { FfbbClubLink } from "@/lib/schemas/ffbb-link";
import type { ClubSummary } from "@/server/db/clubs";
import { FfbbClubSearch } from "./ffbb-club-search";

const t = fr.clubs.ffbb.link;

const LINK_BUTTON_CLASS =
  "self-start text-sm font-medium text-primary underline underline-offset-2 disabled:opacity-60";

type Props = { club: ClubSummary };

export function ClubFfbbLink({ club }: Props) {
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const idBase = `club-ffbb-${club.id}`;

  function save(link: FfbbClubLink) {
    startTransition(async () => {
      let ok: boolean;
      try {
        const state = await setClubFfbbLinkAction(club.id, link);
        ok = state.status === "linked";
      } catch {
        ok = false;
      }
      setSearching(false);
      setMessage(ok ? t.done : t.failed);
    });
  }

  // Club lié : rien à afficher, sauf la confirmation juste après le lien.
  if (club.ffbb !== null && message === null) {
    return null;
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      {club.ffbb !== null ? null : searching ? (
        <div className="flex min-w-0 flex-col gap-2 rounded-md border border-border p-3">
          {isPending ? (
            <p role="status" className="text-sm">
              {t.saving}
            </p>
          ) : (
            <FfbbClubSearch
              idBase={idBase}
              onPick={(picked) => {
                save(picked.ffbb);
              }}
              onManual={(notice) => {
                setSearching(false);
                setMessage(notice);
              }}
              manualLabel={t.cancel}
            />
          )}
        </div>
      ) : (
        <button
          type="button"
          aria-label={t.openLabel.replace("{name}", club.name)}
          onClick={() => {
            setMessage(null);
            setSearching(true);
          }}
          className={LINK_BUTTON_CLASS}
        >
          {t.open}
        </button>
      )}
      {message !== null && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
    </div>
  );
}
