import { describe, expect, it, vi } from "vitest";
import { makeFakeDb } from "../db/fake-db";
import type { FetchLogo } from "../ffbb/ffbb-logos";
import { RETRY_AFTER_MS, getClubLogo } from "./club-logo";

const USER_ID = "3f0c1d52-9b0a-4c55-8a3e-2f6f3a1c9e11";
const CLUB_ID = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c01";
/** Propriétaire du club : ici un autre compte (préparation partagée avec l'utilisateur). */
const OWNER_ID = "5b6c7d8e-9f0a-4b1c-8d2e-3f4a5b6c7d01";
const LOGO = "02175814-01ac-441c-a86a-2f4a9b80b1e0";
const OLD_LOGO = "017bcbd9-c0d2-4c73-ac1f-19805ee9af04";
const NOW = new Date("2026-11-26T12:00:00Z");
const BYTES = Buffer.from([0x52, 0x49, 0x46, 0x46]);

function row(overrides: Record<string, unknown>) {
  return {
    owner_id: OWNER_ID,
    ffbb_logo_uuid: LOGO,
    logo_uuid: null,
    mime: null,
    bytes: null,
    fetched_at: null,
    ...overrides,
  };
}

function setup(rows: Record<string, unknown>[]) {
  const { db, query } = makeFakeDb(rows);
  const fetchLogo = vi.fn<FetchLogo>().mockResolvedValue({ mime: "image/webp", bytes: BYTES });
  return { deps: { db, fetchLogo }, query, fetchLogo };
}

const input = { userId: USER_ID, clubId: CLUB_ID, now: NOW };

describe("getClubLogo", () => {
  it("sert le logo enregistré sans appeler le CDN", async () => {
    const { deps, fetchLogo } = setup([
      row({ logo_uuid: LOGO, mime: "image/webp", bytes: BYTES, fetched_at: NOW }),
    ]);
    expect(await getClubLogo(deps, input)).toEqual({ mime: "image/webp", bytes: BYTES });
    expect(fetchLogo).not.toHaveBeenCalled();
  });

  it("télécharge et enregistre un logo absent ou périmé", async () => {
    const { deps, query, fetchLogo } = setup([
      row({ logo_uuid: OLD_LOGO, mime: "image/png", bytes: BYTES, fetched_at: NOW }),
    ]);
    expect(await getClubLogo(deps, input)).toEqual({ mime: "image/webp", bytes: BYTES });
    expect(fetchLogo).toHaveBeenCalledWith(LOGO);
    expect(query.mock.calls[1]?.[0]).toContain("INSERT INTO club_logo");
    // Enregistré chez le propriétaire du club, pas chez l'utilisateur qui le regarde.
    expect(query.mock.calls[1]?.[1]?.slice(0, 4)).toEqual([CLUB_ID, OWNER_ID, LOGO, "image/webp"]);
  });

  it("retient un échec récent, et retente le lendemain", async () => {
    const recent = setup([row({ logo_uuid: LOGO, fetched_at: NOW })]);
    expect(await getClubLogo(recent.deps, input)).toBeNull();
    expect(recent.fetchLogo).not.toHaveBeenCalled();

    const old = setup([
      row({ logo_uuid: LOGO, fetched_at: new Date(NOW.getTime() - RETRY_AFTER_MS) }),
    ]);
    old.fetchLogo.mockResolvedValue(null);
    expect(await getClubLogo(old.deps, input)).toBeNull();
    expect(old.fetchLogo).toHaveBeenCalledTimes(1);
    // L'échec est enregistré, sans octets.
    expect(old.query.mock.calls[1]?.[1]?.slice(3, 5)).toEqual([null, null]);
  });

  it("rend null pour un club sans logo ou introuvable", async () => {
    const noLogo = setup([row({ ffbb_logo_uuid: null })]);
    expect(await getClubLogo(noLogo.deps, input)).toBeNull();
    expect(noLogo.fetchLogo).not.toHaveBeenCalled();

    const missing = setup([]);
    expect(await getClubLogo(missing.deps, input)).toBeNull();
  });
});
