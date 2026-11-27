/**
 * Logos des clubs (migration 039) : le logo attendu (`club.ffbb_logo_uuid`) et celui
 * enregistré (`club_logo`), téléchargé une fois puis servi par l'application.
 *
 * Lisible par le propriétaire du club (§6.2), et par le destinataire d'une préparation
 * partagée dont le match oppose ce club (règle `VALID_SHARE`, seule exception à
 * l'isolation par compte) : l'en-tête du match partagé montre les clubs du propriétaire.
 * Le logo est toujours enregistré chez le propriétaire du club.
 */
import { z } from "zod";
import type { LogoImage } from "@/server/ffbb/ffbb-logos";
import { SHARE_FROM, VALID_SHARE } from "./share-access";
import type { Queryable } from "./users";

export type StoredClubLogo = {
  logoUuid: string;
  /** `null` : le dernier téléchargement a échoué (à `fetchedAt`). */
  image: LogoImage | null;
  fetchedAt: Date;
};

export type ClubLogoState = {
  /** Propriétaire du club : le logo s'enregistre chez lui. */
  ownerId: string;
  /** Logo FFBB du club, `null` s'il n'en a pas. */
  logoUuid: string | null;
  stored: StoredClubLogo | null;
};

// `cl` et non `l` : `SHARE_FROM` réserve l'alias `l` au lien du collègue.
const FIND_CLUB_LOGO_SQL = `SELECT c.user_id AS owner_id, c.ffbb_logo_uuid, cl.logo_uuid, cl.mime,
  cl.bytes, cl.fetched_at
FROM club c
LEFT JOIN club_logo cl ON cl.club_id = c.id AND cl.user_id = c.user_id
WHERE c.id = $1 AND (
  c.user_id = $2
  OR EXISTS (
    SELECT 1 FROM ${SHARE_FROM}
    JOIN team t ON t.user_id = g.user_id AND t.id IN (g.team1_id, g.team2_id)
    WHERE ${VALID_SHARE} AND s.recipient_user_id = $2
      AND t.club_id = c.id AND t.user_id = c.user_id
  )
)`;

const mimeSchema = z.enum(["image/webp", "image/png", "image/jpeg"]);

const logoRowSchema = z.object({
  owner_id: z.uuid(),
  ffbb_logo_uuid: z.uuid().nullable(),
  logo_uuid: z.uuid().nullable(),
  mime: mimeSchema.nullable(),
  bytes: z.instanceof(Uint8Array).nullable(),
  fetched_at: z.date().nullable(),
});

/**
 * Logo attendu et logo enregistré d'un club que l'utilisateur peut voir (le sien, ou celui
 * d'un match partagé avec lui) ; `null` sinon.
 */
export async function findClubLogo(
  db: Queryable,
  input: { userId: string; clubId: string },
): Promise<ClubLogoState | null> {
  const result = await db.query(FIND_CLUB_LOGO_SQL, [input.clubId, input.userId]);
  const raw: unknown = result.rows[0];
  if (raw === undefined) {
    return null;
  }
  const row = logoRowSchema.parse(raw);
  const stored =
    row.logo_uuid === null || row.fetched_at === null
      ? null
      : {
          logoUuid: row.logo_uuid,
          image:
            row.mime === null || row.bytes === null ? null : { mime: row.mime, bytes: row.bytes },
          fetchedAt: row.fetched_at,
        };
  return { ownerId: row.owner_id, logoUuid: row.ffbb_logo_uuid, stored };
}

// Seulement si le club attend toujours ce logo : un lien changé entre-temps l'emporte.
const SAVE_CLUB_LOGO_SQL = `INSERT INTO club_logo (club_id, user_id, logo_uuid, mime, bytes, fetched_at)
SELECT c.id, c.user_id, $3::uuid, $4::text, $5::bytea, $6::timestamptz
FROM club c
WHERE c.id = $1 AND c.user_id = $2 AND c.ffbb_logo_uuid = $3::uuid
ON CONFLICT (club_id) DO UPDATE
SET logo_uuid = EXCLUDED.logo_uuid, mime = EXCLUDED.mime, bytes = EXCLUDED.bytes,
  fetched_at = EXCLUDED.fetched_at`;

/** Enregistre le logo téléchargé, ou l'échec du téléchargement (`image` nul). */
export async function saveClubLogo(
  db: Queryable,
  input: {
    userId: string;
    clubId: string;
    logoUuid: string;
    image: LogoImage | null;
    fetchedAt: Date;
  },
): Promise<void> {
  await db.query(SAVE_CLUB_LOGO_SQL, [
    input.clubId,
    input.userId,
    input.logoUuid,
    input.image?.mime ?? null,
    input.image === null ? null : Buffer.from(input.image.bytes),
    input.fetchedAt,
  ]);
}
