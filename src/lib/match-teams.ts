/**
 * Équipes d'un match dans un texte (« {team1} – {team2} »). Un plateau n'a qu'un club, son
 * organisateur (§15.4.7) : la paire devient « Plateau chez BC Vannes ». Sert aux pages,
 * aux emails et au flux iCal (pur, sans dépendance de serveur).
 */
import { fr } from "@/i18n/fr";

const PAIR = "{team1} – {team2}";

export function withTeams(format: string, team1: string, team2: string | null): string {
  if (team2 === null) {
    const host = fr.compensations.plateauHost.replace("{club}", () => team1);
    return format.includes(PAIR)
      ? format.replace(PAIR, () => host)
      : format.replace("{team1}", () => host).replace("{team2}", "");
  }
  return format.replace("{team1}", () => team1).replace("{team2}", () => team2);
}
