/**
 * Barème par défaut de chaque niveau, regroupé par catégorie (Départemental, Régional…).
 * Composant serveur : chaque ligne est un petit formulaire client.
 */
import { fr } from "@/i18n/fr";
import type { Division, DivisionCategory } from "@/server/db/divisions";
import type { LevelDefaultRow } from "@/server/db/scales";
import type { LevelDefaultState } from "@/server/scales/manage-scales";
import { divisionLabel } from "./division-label";
import { LevelDefaultForm } from "./level-default-form";

const t = fr.scales;

type Props = {
  divisions: readonly Division[];
  defaults: readonly LevelDefaultRow[];
  scales: readonly { id: string; name: string }[];
  action: (previous: LevelDefaultState, formData: FormData) => Promise<LevelDefaultState>;
};

function groupByCategory(divisions: readonly Division[]): Map<DivisionCategory, Division[]> {
  const groups = new Map<DivisionCategory, Division[]>();
  for (const division of divisions) {
    const group = groups.get(division.category) ?? [];
    group.push(division);
    groups.set(division.category, group);
  }
  return groups;
}

export function LevelDefaults({ divisions, defaults, scales, action }: Props) {
  const chosen = new Map(defaults.map((entry) => [entry.divisionId, entry.scaleId]));

  return (
    <div className="flex flex-col gap-3">
      {[...groupByCategory(divisions)].map(([category, group]) => {
        const customized = group.filter((division) => chosen.has(division.id)).length;
        return (
          <details key={category} className="rounded-md border border-neutral-300 px-3">
            <summary className="flex min-h-11 cursor-pointer flex-wrap items-center gap-x-3 font-medium">
              <span>{t.divisions.category[category]}</span>
              {customized > 0 && (
                <span className="text-sm font-normal text-neutral-700">
                  {t.defaults.customized.replace("{count}", String(customized))}
                </span>
              )}
            </summary>
            <div className="divide-y divide-neutral-200 pb-2">
              {group.map((division) => (
                <LevelDefaultForm
                  key={division.id}
                  divisionId={division.id}
                  divisionLabel={divisionLabel(division)}
                  scales={scales}
                  selectedScaleId={chosen.get(division.id) ?? ""}
                  action={action}
                />
              ))}
            </div>
          </details>
        );
      })}
    </div>
  );
}
