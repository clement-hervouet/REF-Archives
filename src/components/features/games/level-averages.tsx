/**
 * Moyennes des échelles en tête de « Notes de match » (bloc 10) : une carte par échelle,
 * avec la moyenne à une décimale, les cinq cases colorées selon la moyenne arrondie et le
 * nombre de notes qui la renseignent. Elles suivent les filtres de la page.
 */
import { fr } from "@/i18n/fr";
import { NOTE_LEVEL_FIELDS } from "@/lib/game-form-fields";
import type { NoteLevelField } from "@/lib/game-form-fields";
import type { LevelAverage, NoteLevelAverages } from "@/server/db/game-notes";
import { LevelSegments } from "./level-meter";

const t = fr.gameNotes;

const AVERAGE_FORMAT = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** Moyenne affichée (« 3,8 »), arrondie comme le chiffre lu. */
export function formatAverage(average: number): string {
  return AVERAGE_FORMAT.format(average);
}

function countLabel(count: number): string {
  return count === 1 ? t.averages.countOne : t.averages.countMany.replace("{count}", String(count));
}

/** Vrai si au moins une échelle est renseignée dans les notes concernées. */
export function hasAnyAverage(averages: NoteLevelAverages): boolean {
  return NOTE_LEVEL_FIELDS.some((field) => averages[field].average !== null);
}

function AverageCard({ field, value }: { field: NoteLevelField; value: LevelAverage }) {
  const label = t.levelLabels[field];
  if (value.average === null) {
    return (
      <div className="flex flex-col gap-1 rounded-md border border-border p-3">
        <dt className="text-sm text-muted-foreground">{label}</dt>
        <dd className="text-sm text-muted-foreground">{t.averages.none}</dd>
      </div>
    );
  }
  const shown = formatAverage(value.average);
  const count = countLabel(value.count);
  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-border p-3">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd
        className="flex flex-col"
        aria-label={t.averages.aria
          .replace("{label}", label)
          .replace("{value}", shown)
          .replace("{count}", count)}
      >
        <span className="flex items-baseline gap-1" aria-hidden="true">
          <span className="text-2xl font-semibold tabular-nums">{shown}</span>
          <span className="text-sm text-muted-foreground">/5</span>
        </span>
        <span className="mt-1.5" aria-hidden="true">
          <LevelSegments kind={field} value={Math.round(value.average)} />
        </span>
        <span className="mt-1.5 text-sm text-muted-foreground" aria-hidden="true">
          {count}
        </span>
      </dd>
    </div>
  );
}

export function LevelAverages({
  averages,
  filtered,
}: {
  averages: NoteLevelAverages;
  filtered: boolean;
}) {
  return (
    <section aria-labelledby="note-averages" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id="note-averages" className="font-semibold">
          {t.averages.title}
        </h2>
        <p className="text-sm text-muted-foreground">
          {filtered ? t.averages.filtered : t.averages.all}
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {NOTE_LEVEL_FIELDS.map((field) => (
          <AverageCard key={field} field={field} value={averages[field]} />
        ))}
      </dl>
    </section>
  );
}
