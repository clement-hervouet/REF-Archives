/**
 * Échelle de 1 à 5 en lecture (bloc 10) : libellé, cinq cases dont les premières sont
 * remplies dans la couleur du ton, et le chiffre « 4/5 ». Annoncée en une phrase aux
 * lecteurs d'écran (« Confiance : 4 sur 5 »). `LevelSegments` sert aussi aux moyennes.
 */
import { fr } from "@/i18n/fr";
import { NOTE_LEVELS } from "@/lib/game-form-fields";
import { cn } from "@/lib/utils";
import { TONE_FILL, levelTone } from "./level-tone";
import type { LevelKind } from "./level-tone";

const t = fr.gameNotes;

/** Cinq cases, les `value` premières remplies dans la couleur du ton (décoratif). */
export function LevelSegments({ kind, value }: { kind: LevelKind; value: number }) {
  const fill = TONE_FILL[levelTone(kind, value)];
  return (
    <span className="flex gap-0.5" aria-hidden="true">
      {NOTE_LEVELS.map((level) => (
        <span
          key={level}
          className={cn("h-2.5 w-4 rounded-sm", level <= value ? fill : "bg-border")}
        />
      ))}
    </span>
  );
}

export function LevelMeter({ kind, value }: { kind: LevelKind; value: number }) {
  const label = t.levelLabels[kind];
  return (
    <div
      role="img"
      aria-label={t.levelAria.replace("{label}", label).replace("{value}", String(value))}
      className="flex items-center gap-2"
    >
      <span className="w-20 text-sm text-muted-foreground" aria-hidden="true">
        {label}
      </span>
      <LevelSegments kind={kind} value={value} />
      <span className="text-sm font-semibold tabular-nums" aria-hidden="true">
        {value}/5
      </span>
    </div>
  );
}
