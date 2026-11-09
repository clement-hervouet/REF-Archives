/**
 * Guirlande lumineuse de décembre (bloc 12, §3.14), faite main en CSS : un fil en haut
 * de la zone de contenu et des ampoules qui scintillent l'une après l'autre. Derrière le
 * contenu comme le calque animé, purement décorative. Couleurs, rythme et nombre
 * d'ampoules visibles selon la largeur : classes `seasonal-garland*` de `globals.css`
 * (aucun attribut `style`, CSP stricte). Sans animation si l'appareil le demande (règle
 * `prefers-reduced-motion` globale) : les ampoules restent allumées.
 */

/** Assez pour un grand écran ; les plus petits en masquent une partie (CSS). */
const BULB_COUNT = 28;

export function SeasonalGarland() {
  return (
    <div aria-hidden="true" className="seasonal-garland">
      {Array.from({ length: BULB_COUNT }, (_, index) => (
        <span key={index} className="seasonal-garland-bulb" />
      ))}
    </div>
  );
}
