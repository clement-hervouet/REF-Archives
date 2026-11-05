import { describe, expect, it, vi } from "vitest";
import { handleUpdateProfile } from "./profile";
import type { ProfileDeps } from "./profile";

const USER_ID = "3f0c1d52-9b0a-4c55-8a3e-2f6f3a1c9e11";

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(values)) {
    data.set(name, value);
  }
  return data;
}

function setup(updated = true) {
  const update = vi.fn<ProfileDeps["update"]>().mockResolvedValue(updated);
  return { deps: { update } satisfies ProfileDeps, update };
}

describe("handleUpdateProfile", () => {
  it("enregistre le nom et le prénom nettoyés pour l'utilisateur de la session", async () => {
    const { deps, update } = setup();
    const state = await handleUpdateProfile(
      deps,
      USER_ID,
      form({ firstname: " Clément ", lastname: "Hervouet " }),
    );
    expect(state).toEqual({ status: "saved" });
    expect(update).toHaveBeenCalledWith(USER_ID, { firstname: "Clément", lastname: "Hervouet" });
  });

  it("ignore un identifiant d'utilisateur glissé dans le formulaire", async () => {
    const { deps, update } = setup();
    await handleUpdateProfile(
      deps,
      USER_ID,
      form({ firstname: "Clem", lastname: "H", userId: "9d6c2f4e-1b7a-4e0c-9a55-0c2d7f1e8b33" }),
    );
    expect(update.mock.lastCall?.[0]).toBe(USER_ID);
  });

  it("renvoie les codes d'erreur sans rien enregistrer", async () => {
    const { deps, update } = setup();
    const state = await handleUpdateProfile(deps, USER_ID, form({ firstname: "", lastname: "H" }));
    expect(state).toEqual({ status: "invalid", issues: ["firstname.required"] });
    expect(update).not.toHaveBeenCalled();
  });

  it("signale un compte qui n'existe plus", async () => {
    const { deps } = setup(false);
    expect(
      await handleUpdateProfile(deps, USER_ID, form({ firstname: "Clem", lastname: "H" })),
    ).toEqual({ status: "not_found" });
  });
});
