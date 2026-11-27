/**
 * Logos des clubs, téléchargés côté serveur depuis le CDN de la FFBB
 * (`https://api.ffbb.com/assets/<uuid>`), jamais par le navigateur ni par le relais
 * d'assets de ffbb-api.desimone.fr (qui se présente comme un contournement de blocage).
 *
 * Le CDN redimensionne et convertit : on demande un WebP de 256 px de haut (les logos sont
 * en portrait, avec de grandes marges), mis en forme ensuite par `logo-background.ts`. Le
 * CDN refuse ou répond mal : `null`, et la pastille montre les initiales du club. Rien n'est relayé sans vérification : UUID validé avant l'appel,
 * type déclaré ET octets magiques d'une image matricielle (jamais de SVG, qui peut porter
 * du script), taille plafonnée.
 */
import { z } from "zod";

const FFBB_ASSETS_URL = "https://api.ffbb.com/assets";
/** Le CDN répond en quelques centaines de millisecondes : au-delà de 5 s, on abandonne. */
const TIMEOUT_MS = 5_000;
/** Un logo de 256 px pèse une dizaine de Ko ; un original, au plus 111 Ko observés. */
export const MAX_LOGO_BYTES = 200 * 1024;
/** Le double de la pastille : le logo est ensuite rogné (marges vides) puis réduit. */
const LOGO_HEIGHT = 256;

export type LogoMime = "image/webp" | "image/png" | "image/jpeg";

export type LogoImage = { mime: LogoMime; bytes: Uint8Array };

/** Télécharge le logo `uuid` ; `null` en cas d'échec (jamais d'exception). */
export type FetchLogo = (uuid: string) => Promise<LogoImage | null>;

const uuidSchema = z.uuid();

function startsWith(bytes: Uint8Array, prefix: readonly number[], offset = 0): boolean {
  return prefix.every((byte, index) => bytes[offset + index] === byte);
}

const ascii = (text: string) => Array.from(text, (char) => char.charCodeAt(0));

/** Type réel d'une image d'après ses premiers octets ; `null` si ce n'est pas un raster connu. */
export function sniffImage(bytes: Uint8Array): LogoMime | null {
  if (startsWith(bytes, ascii("RIFF")) && startsWith(bytes, ascii("WEBP"), 8)) {
    return "image/webp";
  }
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }
  return startsWith(bytes, [0xff, 0xd8, 0xff]) ? "image/jpeg" : null;
}

/** Type déclaré, sans paramètres (`image/webp; charset=…` → `image/webp`). */
function declaredMime(response: Response): string {
  return (response.headers.get("content-type") ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
}

/** Corps de la réponse, lu jusqu'à `max` octets ; `null` au-delà. */
async function readCapped(response: Response, max: number): Promise<Uint8Array | null> {
  const announced = Number(response.headers.get("content-length") ?? "0");
  if (announced > max || response.body === null) {
    return null;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    total += value.byteLength;
    if (total > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

/** Vérifie une réponse du CDN : statut, type déclaré et réel identiques, taille. */
export async function toLogoImage(response: Response): Promise<LogoImage | null> {
  if (!response.ok) {
    return null;
  }
  const declared = declaredMime(response);
  const bytes = await readCapped(response, MAX_LOGO_BYTES);
  if (bytes === null || bytes.byteLength === 0) {
    return null;
  }
  const mime = sniffImage(bytes);
  return mime !== null && mime === declared ? { mime, bytes } : null;
}

export function createFetchLogo(fetchImpl: typeof fetch = fetch): FetchLogo {
  return async (uuid) => {
    if (!uuidSchema.safeParse(uuid).success) {
      return null;
    }
    try {
      const response = await fetchImpl(
        `${FFBB_ASSETS_URL}/${uuid}?height=${String(LOGO_HEIGHT)}&format=webp`,
        {
          headers: { Accept: "image/webp,image/png,image/jpeg" },
          signal: AbortSignal.timeout(TIMEOUT_MS),
          redirect: "error",
          cache: "no-store",
        },
      );
      return await toLogoImage(response);
    } catch (error) {
      console.error(`[ffbb] logo impossible (${error instanceof Error ? error.name : "inconnue"})`);
      return null;
    }
  };
}
