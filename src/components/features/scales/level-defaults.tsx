/**
 * Barème par défaut de chaque niveau, regroupé par catégorie (Départemental, Régional…),
 * puis par portée de coupe (§15.4.6). Composant serveur : chaque ligne est un petit
 * formulaire client.
 */
import { ChevronDown } from "lucide-react";
import { fr } from "@/i18n/fr";
import type { Division } from "@/server/db/divisions";
import type { LevelDefaultRow } from "@/server/db/scales";
import type { LevelDefaultState } from "@/server/scales/manage-scales";
import { divisionLabel, groupDivisions } from "./division-label";
import { LevelDefaultForm } from "./level-default-form";

const t = fr.scales;

type Props = {
  divisions: readonly Division[];
  defaults: readonly LevelDefaultRow[];
  scales: readonly { id: string; name: string }[];
  action: (previous: LevelDefaultState, formData: FormData) => Promise<LevelDefaultState>;
};

function customizedLabel(count: number): string {
  if (count === 0) return t.defaults.customizedNone;
  if (count === 1) return t.defaults.customizedOne;
  return t.defaults.customizedMany.replace("{count}", String(count));
}

export function LevelDefaults({ divisions, defaults, scales, action }: Props) {
  const chosen = new Map(defaults.map((entry) => [entry.divisionId, entry.scaleId]));

  return (
    <div className="flex flex-col gap-3">
      {groupDivisions(divisions).map(({ key, label, divisions: group }) => {
        const customized = group.filter((division) => chosen.has(division.id)).length;
        return (
          <details key={key} className="group rounded-md border border-border">
            <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-4 select-none hover:bg-accent [&::-webkit-details-marker]:hidden">
              <span className="font-medium">{label}</span>
              <span className="ml-auto text-sm text-muted-foreground">
                {customizedLabel(customized)}
              </span>
              <ChevronDown
                aria-hidden="true"
                className="size-4 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none"
              />
            </summary>
            <div className="divide-y divide-border border-t border-border px-4 pb-1">
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
