import { describe, expect, it } from "vitest";
import { makeFakeDb } from "../db/fake-db";
import type { Queryable } from "../db/users";
import {
  handleAddClubVenues,
  handleCreateClub,
  handleDeleteClub,
  handleRemoveClubVenue,
  handleSetClubFfbbLink,
  handleSetMainClubVenue,
  handleUpdateClub,
  readClubFormData,
} from "./manage-clubs";
import type { ClubDeps } from "./manage-clubs";

const USER_ID = "3f0c1d52-9b0a-4c55-8a3e-2f6f3a1c9e11";
const CLUB_ID = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c01";
const ADDRESS_ID = "9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b01";
const VENUE_ID = "9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b02";
const LOGO = "02175814-01ac-441c-a86a-2f4a9b80b1e0";

const BEAUREGARD = {
  name: "Gymnase de Beauregard",
  street: "Avenue André Malraux",
  number: "17",
  postalCode: "35000",
  city: "Rennes",
};

function formData(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(entries)) {
    data.set(name, value);
  }
  return data;
}

function setup() {
  const { db, query } = makeFakeDb();
  const deps = {
    transaction: <T>(action: (tx: Queryable) => Promise<T>) => action(db),
  } satisfies ClubDeps;
  return { deps, query };
}

const FULL = {
  name: " BC Béthune ",
  street: "Avenue du Sport",
  number: "2",
  postalCode: "62400",
  city: "Béthune",
  country: "",
};

describe("readClubFormData", () => {
  it("remplace un champ facultatif absent par une saisie vide", () => {
    expect(readClubFormData(formData({ name: "BC Béthune", postalCode: "62400" }))).toEqual({
      name: "BC Béthune",
      venueName: "",
      street: "",
      number: "",
      postalCode: "62400",
      city: "",
      country: "",
      venues: [],
    });
  });
});

describe("handleCreateClub", () => {
  it("crée un club avec son nom et son code postal seulement", async () => {
    const { deps, query } = setup();
    query.mockResolvedValueOnce({ rows: [{ id: CLUB_ID }] });
    expect(
      await handleCreateClub(deps, USER_ID, formData({ name: "BC Béthune", postalCode: "62400" })),
    ).toEqual({ status: "created" });
    expect(query.mock.calls[0]?.[1]).toEqual([
      USER_ID,
      "BC BÉTHUNE",
      null,
      null,
      "62400",
      null,
      null,
      null,
      1000,
      null,
      null,
      null,
    ]);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("crée un club de l'annuaire FFBB avec sa salle principale et ses autres salles", async () => {
    const { deps, query } = setup();
    query
      .mockResolvedValueOnce({ rows: [{ id: CLUB_ID }] })
      .mockResolvedValueOnce({ rows: [{ id: VENUE_ID }] })
      .mockResolvedValueOnce({ rows: [{ address_id: VENUE_ID }] });
    expect(
      await handleCreateClub(
        deps,
        USER_ID,
        formData({
          ...FULL,
          venueName: "Gymnase de la Courrouze",
          venues: JSON.stringify([BEAUREGARD]),
        }),
      ),
    ).toEqual({ status: "created" });
    expect(query.mock.calls[0]?.[1]?.[7]).toBe("Gymnase de la Courrouze");
    // Autre salle retrouvée ou créée, puis rattachée au club.
    expect(query.mock.calls[1]?.[1]).toEqual([
      USER_ID,
      "Avenue André Malraux",
      "17",
      "35000",
      "Rennes",
      null,
      "Gymnase de Beauregard",
    ]);
    expect(query.mock.calls[2]?.[0]).toContain("INSERT INTO club_venue");
    expect(query.mock.calls[2]?.[1]).toEqual([CLUB_ID, VENUE_ID, USER_ID, 19]);
  });

  it("enregistre le lien FFBB du club choisi, et ignore un lien illisible", async () => {
    const linked = setup();
    linked.query.mockResolvedValueOnce({ rows: [{ id: CLUB_ID }] });
    await handleCreateClub(
      linked.deps,
      USER_ID,
      formData({ ...FULL, ffbb: JSON.stringify({ id: "9326", logoUuid: LOGO, color: "#EB6D88" }) }),
    );
    expect(linked.query.mock.calls[0]?.[1]?.slice(9)).toEqual(["9326", LOGO, "#eb6d88"]);

    const broken = setup();
    broken.query.mockResolvedValueOnce({ rows: [{ id: CLUB_ID }] });
    expect(
      await handleCreateClub(
        broken.deps,
        USER_ID,
        formData({ ...FULL, ffbb: JSON.stringify({ id: "x", logoUuid: "../", color: null }) }),
      ),
    ).toEqual({ status: "created" });
    expect(broken.query.mock.calls[0]?.[1]?.slice(9)).toEqual([null, null, null]);
  });

  it("accepte les salles cochées telles que la liste les envoie (champs inconnus à null)", async () => {
    const { deps, query } = setup();
    query
      .mockResolvedValueOnce({ rows: [{ id: CLUB_ID }] })
      .mockResolvedValueOnce({ rows: [{ id: VENUE_ID }] })
      .mockResolvedValueOnce({ rows: [{ address_id: VENUE_ID }] });
    const venues = JSON.stringify([
      {
        name: "Salle du Berry",
        number: null,
        street: "Square du Berry",
        postalCode: "35000",
        city: "Rennes",
      },
    ]);
    expect(await handleCreateClub(deps, USER_ID, formData({ ...FULL, venues }))).toEqual({
      status: "created",
    });
    expect(query.mock.calls[1]?.[1]).toEqual([
      USER_ID,
      "Square du Berry",
      null,
      "35000",
      "Rennes",
      null,
      "Salle du Berry",
    ]);
  });

  it("refuse une liste de salles illisible, sans requête", async () => {
    const { deps, query } = setup();
    expect(
      await handleCreateClub(deps, USER_ID, formData({ ...FULL, venues: "{pas du json" })),
    ).toEqual({ status: "invalid", fields: ["venues"] });
    expect(query).not.toHaveBeenCalled();
  });

  it("crée un club avec son adresse complète", async () => {
    const { deps, query } = setup();
    query.mockResolvedValueOnce({ rows: [{ id: CLUB_ID }] });
    expect(await handleCreateClub(deps, USER_ID, formData(FULL))).toEqual({ status: "created" });
    expect(query.mock.calls[0]?.[1]?.slice(1, 7)).toEqual([
      "BC BÉTHUNE",
      "Avenue du Sport",
      "2",
      "62400",
      "Béthune",
      null,
    ]);
  });

  it("refuse un club sans nom ni code postal, sans requête", async () => {
    const { deps, query } = setup();
    expect(
      await handleCreateClub(deps, USER_ID, formData({ ...FULL, name: " ", postalCode: "" })),
    ).toEqual({ status: "invalid", fields: ["name", "postalCode"] });
    expect(query).not.toHaveBeenCalled();
  });

  it("refuse une rue sur plusieurs lignes", async () => {
    const { deps } = setup();
    expect(
      await handleCreateClub(deps, USER_ID, formData({ ...FULL, street: "Rue\ndu Sport" })),
    ).toEqual({ status: "invalid", fields: ["street"] });
  });

  it("signale la limite de clubs", async () => {
    const { deps, query } = setup();
    query.mockResolvedValueOnce({ rows: [{ id: null }] });
    expect(await handleCreateClub(deps, USER_ID, formData(FULL))).toEqual({
      status: "limit_reached",
    });
  });
});

describe("handleUpdateClub", () => {
  it("modifie le nom et l'adresse du club de l'utilisateur", async () => {
    const { deps, query } = setup();
    query.mockResolvedValueOnce({ rows: [{ id: ADDRESS_ID }] });
    expect(await handleUpdateClub(deps, USER_ID, formData({ ...FULL, clubId: CLUB_ID }))).toEqual({
      status: "updated",
    });
    expect(query.mock.calls[0]?.[1]).toEqual([
      CLUB_ID,
      USER_ID,
      "BC BÉTHUNE",
      "Avenue du Sport",
      "2",
      "62400",
      "Béthune",
      null,
      null,
    ]);
  });

  it("répond introuvable pour un club d'un autre compte", async () => {
    const { deps, query } = setup();
    query.mockResolvedValueOnce({ rows: [] });
    expect(await handleUpdateClub(deps, USER_ID, formData({ ...FULL, clubId: CLUB_ID }))).toEqual({
      status: "not_found",
    });
  });

  it("refuse un identifiant mal formé sans requête", async () => {
    const { deps, query } = setup();
    expect(await handleUpdateClub(deps, USER_ID, formData({ ...FULL, clubId: "1" }))).toEqual({
      status: "not_found",
    });
    expect(query).not.toHaveBeenCalled();
  });
});

describe("handleDeleteClub", () => {
  it("supprime le club puis ses salles qui ne sont plus utilisées", async () => {
    const { deps, query } = setup();
    query
      .mockResolvedValueOnce({ rows: [{ address_id: VENUE_ID }] })
      .mockResolvedValueOnce({ rows: [{ address_id: ADDRESS_ID }] })
      .mockResolvedValueOnce({ rows: [] });
    expect(await handleDeleteClub(deps, USER_ID, formData({ clubId: CLUB_ID }))).toEqual({
      status: "deleted",
    });
    expect(query.mock.calls[0]?.[0]).toContain("FROM club_venue");
    expect(query.mock.calls[1]?.[1]).toEqual([CLUB_ID, USER_ID]);
    expect(query.mock.calls[2]?.[0]).toContain("DELETE FROM address");
    expect(query.mock.calls[2]?.[1]).toEqual([[ADDRESS_ID, VENUE_ID], USER_ID]);
  });

  it("refuse un club cité par une indemnité ou un match", async () => {
    const { deps, query } = setup();
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: CLUB_ID }] });
    expect(await handleDeleteClub(deps, USER_ID, formData({ clubId: CLUB_ID }))).toEqual({
      status: "in_use",
    });
  });

  it("répond introuvable pour un club inconnu", async () => {
    const { deps, query } = setup();
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    expect(await handleDeleteClub(deps, USER_ID, formData({ clubId: CLUB_ID }))).toEqual({
      status: "not_found",
    });
  });
});

describe("handleAddClubVenues", () => {
  it("rattache les salles importées, retrouvées ou créées", async () => {
    const { deps, query } = setup();
    query
      .mockResolvedValueOnce({ rows: [{ address_id: ADDRESS_ID, venue_count: 0 }] })
      .mockResolvedValueOnce({ rows: [{ id: VENUE_ID }] })
      .mockResolvedValueOnce({ rows: [{ address_id: VENUE_ID }] })
      // Salle principale du club : retrouvée, mais pas rattachée une deuxième fois.
      .mockResolvedValueOnce({ rows: [{ id: ADDRESS_ID }] })
      .mockResolvedValueOnce({ rows: [] });
    expect(
      await handleAddClubVenues(
        deps,
        USER_ID,
        formData({
          clubId: CLUB_ID,
          venues: JSON.stringify([BEAUREGARD, { ...BEAUREGARD, name: "Courrouze" }]),
        }),
      ),
    ).toEqual({ status: "added", count: 1 });
    expect(query.mock.calls[0]?.[0]).toContain("FOR UPDATE");
    expect(query.mock.calls[0]?.[1]).toEqual([CLUB_ID, USER_ID]);
    expect(query.mock.calls[2]?.[1]).toEqual([CLUB_ID, VENUE_ID, USER_ID, 19]);
  });

  it("ajoute une salle saisie à la main", async () => {
    const { deps, query } = setup();
    query
      .mockResolvedValueOnce({ rows: [{ address_id: ADDRESS_ID, venue_count: 3 }] })
      .mockResolvedValueOnce({ rows: [{ id: VENUE_ID }] })
      .mockResolvedValueOnce({ rows: [{ address_id: VENUE_ID }] });
    expect(
      await handleAddClubVenues(
        deps,
        USER_ID,
        formData({ clubId: CLUB_ID, venueName: " Salle du Berry ", postalCode: "35000" }),
      ),
    ).toEqual({ status: "added", count: 1 });
    expect(query.mock.calls[1]?.[1]).toEqual([
      USER_ID,
      null,
      null,
      "35000",
      null,
      null,
      "Salle du Berry",
    ]);
  });

  it("ne crée rien quand le club a déjà toutes ses salles", async () => {
    const { deps, query } = setup();
    query.mockResolvedValueOnce({ rows: [{ address_id: ADDRESS_ID, venue_count: 19 }] });
    expect(
      await handleAddClubVenues(
        deps,
        USER_ID,
        formData({ clubId: CLUB_ID, venues: JSON.stringify([BEAUREGARD]) }),
      ),
    ).toEqual({ status: "full" });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("signale une salle déjà rattachée", async () => {
    const { deps, query } = setup();
    query
      .mockResolvedValueOnce({ rows: [{ address_id: ADDRESS_ID, venue_count: 1 }] })
      .mockResolvedValueOnce({ rows: [{ id: VENUE_ID }] })
      .mockResolvedValueOnce({ rows: [] });
    expect(
      await handleAddClubVenues(
        deps,
        USER_ID,
        formData({ clubId: CLUB_ID, venues: JSON.stringify([BEAUREGARD]) }),
      ),
    ).toEqual({ status: "unchanged" });
  });

  it("refuse une salle sans code postal, sans requête", async () => {
    const { deps, query } = setup();
    expect(
      await handleAddClubVenues(
        deps,
        USER_ID,
        formData({ clubId: CLUB_ID, venueName: "Salle", street: "Rue\nA", postalCode: "" }),
      ),
    ).toEqual({ status: "invalid", fields: ["street", "postalCode"] });
    expect(query).not.toHaveBeenCalled();
  });

  it("répond introuvable pour un club d'un autre compte", async () => {
    const { deps, query } = setup();
    query.mockResolvedValueOnce({ rows: [] });
    expect(
      await handleAddClubVenues(
        deps,
        USER_ID,
        formData({ clubId: CLUB_ID, venues: JSON.stringify([BEAUREGARD]) }),
      ),
    ).toEqual({ status: "not_found" });
    expect(query).toHaveBeenCalledTimes(1);
  });
});

describe("handleRemoveClubVenue", () => {
  it("retire la salle puis son adresse si plus rien ne la cite", async () => {
    const { deps, query } = setup();
    query
      .mockResolvedValueOnce({ rows: [{ address_id: VENUE_ID }] })
      .mockResolvedValueOnce({ rows: [] });
    expect(
      await handleRemoveClubVenue(
        deps,
        USER_ID,
        formData({ clubId: CLUB_ID, addressId: VENUE_ID }),
      ),
    ).toEqual({ status: "removed" });
    expect(query.mock.calls[0]?.[1]).toEqual([CLUB_ID, USER_ID, VENUE_ID]);
    expect(query.mock.calls[1]?.[1]).toEqual([[VENUE_ID], USER_ID]);
  });

  it("répond introuvable pour une salle qui n'est pas au club", async () => {
    const { deps, query } = setup();
    query.mockResolvedValueOnce({ rows: [] });
    expect(
      await handleRemoveClubVenue(
        deps,
        USER_ID,
        formData({ clubId: CLUB_ID, addressId: ADDRESS_ID }),
      ),
    ).toEqual({ status: "not_found" });
    expect(query).toHaveBeenCalledTimes(1);
  });
});

describe("handleSetMainClubVenue", () => {
  it("échange la salle principale avec une autre salle du club", async () => {
    const { deps, query } = setup();
    query
      .mockResolvedValueOnce({ rows: [{ address_id: ADDRESS_ID, venue_count: 1 }] })
      .mockResolvedValueOnce({ rows: [{ address_id: VENUE_ID }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    expect(
      await handleSetMainClubVenue(
        deps,
        USER_ID,
        formData({ clubId: CLUB_ID, addressId: VENUE_ID }),
      ),
    ).toEqual({ status: "main_set" });
    expect(query.mock.calls[2]?.[0]).toContain("UPDATE club SET address_id");
    expect(query.mock.calls[2]?.[1]).toEqual([CLUB_ID, USER_ID, VENUE_ID]);
    // L'ancienne salle principale reste une salle du club.
    expect(query.mock.calls[3]?.[1]).toEqual([CLUB_ID, USER_ID, ADDRESS_ID]);
  });

  it("répond introuvable pour une salle qui n'est pas au club", async () => {
    const { deps, query } = setup();
    query
      .mockResolvedValueOnce({ rows: [{ address_id: ADDRESS_ID, venue_count: 0 }] })
      .mockResolvedValueOnce({ rows: [] });
    expect(
      await handleSetMainClubVenue(
        deps,
        USER_ID,
        formData({ clubId: CLUB_ID, addressId: VENUE_ID }),
      ),
    ).toEqual({ status: "not_found" });
    expect(query).toHaveBeenCalledTimes(2);
  });
});

describe("handleSetClubFfbbLink", () => {
  it("lie un club de l'utilisateur à l'annuaire FFBB", async () => {
    const { deps, query } = setup();
    query.mockResolvedValueOnce({ rows: [{ id: CLUB_ID }] });
    expect(
      await handleSetClubFfbbLink(deps, USER_ID, {
        clubId: CLUB_ID,
        link: { id: "9326", logoUuid: LOGO, color: "#263a5d" },
      }),
    ).toEqual({ status: "linked" });
    expect(query.mock.calls[0]?.[1]).toEqual([CLUB_ID, USER_ID, "9326", LOGO, "#263a5d"]);
    // L'ancien logo enregistré part s'il ne correspond plus.
    expect(query.mock.calls[0]?.[0]).toContain("DELETE FROM club_logo");
  });

  it("retire le lien", async () => {
    const { deps, query } = setup();
    query.mockResolvedValueOnce({ rows: [{ id: CLUB_ID }] });
    expect(await handleSetClubFfbbLink(deps, USER_ID, { clubId: CLUB_ID, link: null })).toEqual({
      status: "unlinked",
    });
    expect(query.mock.calls[0]?.[1]).toEqual([CLUB_ID, USER_ID, null, null, null]);
  });

  it("refuse un argument mal formé, et répond introuvable pour le club d'un autre", async () => {
    const { deps, query } = setup();
    expect(
      await handleSetClubFfbbLink(deps, USER_ID, {
        clubId: CLUB_ID,
        link: { id: "9326", logoUuid: "https://exemple.fr/logo.svg", color: null },
      }),
    ).toEqual({ status: "invalid" });
    expect(query).not.toHaveBeenCalled();
    expect(await handleSetClubFfbbLink(deps, USER_ID, { clubId: CLUB_ID, link: null })).toEqual({
      status: "not_found",
    });
  });
});
