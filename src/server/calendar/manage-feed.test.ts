import { describe, expect, it, vi } from "vitest";
import { hashToken } from "@/server/auth/tokens";
import { handleManageCalendarFeed, toWebcalUrl } from "./manage-feed";
import type { ManageCalendarFeedDeps } from "./manage-feed";

const USER_ID = "3f0c1d52-9b0a-4c55-8a3e-2f6f3a1c9e11";
const TOKEN = "t".repeat(43);

function form(intent?: string, extra: Record<string, string> = {}): FormData {
  const data = new FormData();
  if (intent !== undefined) {
    data.set("intent", intent);
  }
  for (const [name, value] of Object.entries(extra)) {
    data.set(name, value);
  }
  return data;
}

function makeDeps(removed = true) {
  const replace = vi.fn<ManageCalendarFeedDeps["replace"]>().mockResolvedValue(undefined);
  const remove = vi.fn<ManageCalendarFeedDeps["remove"]>().mockResolvedValue(removed);
  const record = vi.fn<ManageCalendarFeedDeps["record"]>().mockResolvedValue(undefined);
  const deps: ManageCalendarFeedDeps = {
    replace,
    remove,
    record,
    appUrl: "https://ref.example.fr",
    generate: () => ({ token: TOKEN, hash: hashToken(TOKEN) }),
  };
  return { deps, replace, remove, record };
}

describe("handleManageCalendarFeed", () => {
  it("crée le lien : stocke l'empreinte, journalise et renvoie l'URL une fois", async () => {
    const { deps, replace, record } = makeDeps();
    expect(await handleManageCalendarFeed(deps, USER_ID, form("create"))).toEqual({
      status: "created",
      url: `https://ref.example.fr/api/ical/${TOKEN}.ics`,
      webcalUrl: `webcal://ref.example.fr/api/ical/${TOKEN}.ics`,
    });
    expect(replace).toHaveBeenCalledWith(USER_ID, hashToken(TOKEN));
    expect(record).toHaveBeenCalledWith("calendar_feed_created", USER_ID);
  });

  it("ne stocke jamais le jeton en clair", async () => {
    const { deps, replace } = makeDeps();
    await handleManageCalendarFeed(deps, USER_ID, form("create"));
    expect(JSON.stringify(replace.mock.calls)).not.toContain(TOKEN);
  });

  it("utilise un nouveau jeton aléatoire à chaque création par défaut", async () => {
    const { replace, remove, record } = makeDeps();
    const withoutGenerate = { replace, remove, record, appUrl: "https://ref.example.fr" };
    const first = await handleManageCalendarFeed(withoutGenerate, USER_ID, form("create"));
    const second = await handleManageCalendarFeed(withoutGenerate, USER_ID, form("create"));
    expect(first).not.toEqual(second);
    expect(replace.mock.calls[0]?.[1]).not.toEqual(replace.mock.calls[1]?.[1]);
  });

  it("révoque le lien et journalise", async () => {
    const { deps, remove, record } = makeDeps(true);
    expect(await handleManageCalendarFeed(deps, USER_ID, form("revoke"))).toEqual({
      status: "revoked",
    });
    expect(remove).toHaveBeenCalledWith(USER_ID);
    expect(record).toHaveBeenCalledWith("calendar_feed_revoked", USER_ID);
  });

  it("signale l'absence de lien à révoquer, sans journaliser", async () => {
    const { deps, record } = makeDeps(false);
    expect(await handleManageCalendarFeed(deps, USER_ID, form("revoke"))).toEqual({
      status: "not_found",
    });
    expect(record).not.toHaveBeenCalled();
  });

  it("refuse une intention invalide sans rien modifier", async () => {
    const { deps, replace, remove } = makeDeps();
    expect(await handleManageCalendarFeed(deps, USER_ID, form("purge"))).toEqual({
      status: "invalid",
    });
    expect(await handleManageCalendarFeed(deps, USER_ID, form())).toEqual({ status: "invalid" });
    expect(replace).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it("ignore un identifiant d'utilisateur glissé dans le formulaire", async () => {
    const { deps, remove } = makeDeps();
    await handleManageCalendarFeed(
      deps,
      USER_ID,
      form("revoke", { userId: "5b1e8a07-3c44-4d9b-8f12-7a6d0c9e2f44" }),
    );
    expect(remove).toHaveBeenCalledWith(USER_ID);
  });
});

describe("toWebcalUrl", () => {
  it("remplace le schéma http(s) par webcal", () => {
    expect(toWebcalUrl("https://a.fr/api/ical/x.ics")).toBe("webcal://a.fr/api/ical/x.ics");
    expect(toWebcalUrl("http://localhost:3000/x.ics")).toBe("webcal://localhost:3000/x.ics");
  });
});
