import { afterEach, describe, expect, it, vi } from "vitest";
import { getFfbbClub, normalizePlace, searchFfbbClubs, splitStreet, titleCase } from "./ffbb-clubs";
import type { FfbbFetch } from "./ffbb-clubs";

afterEach(() => {
  vi.restoreAllMocks();
});

function fakeFetch(response: unknown): { fetchJson: FfbbFetch; paths: string[] } {
  const paths: string[] = [];
  return {
    paths,
    fetchJson: (path) => {
      paths.push(path);
      return Promise.resolve(response);
    },
  };
}

const failingFetch: FfbbFetch = () => Promise.reject(new Error("timeout"));

function organisme(
  id: string | number,
  nom: string,
  commune: string,
  options: { type?: string; association?: string; postalCode?: string } = {},
) {
  return {
    id,
    nom,
    type: options.type ?? "Groupement",
    type_association: { libelle: options.association ?? "Club" },
    commune: { code_postal: options.postalCode ?? "35000", libelle: commune },
  };
}

function searchResponse(hits: unknown[]) {
  return [
    { index_uid: "ffbbserver_rencontres", hits: [{ id: "x" }] },
    { index_uid: "ffbbserver_organismes", hits },
  ];
}

describe("normalizePlace", () => {
  it("retire accents et ponctuation, développe st et ste", () => {
    expect(normalizePlace("  Bédée ")).toBe("bedee");
    expect(normalizePlace("St-Grégoire")).toBe("saint gregoire");
    expect(normalizePlace("STE FOY-LÈS-LYON")).toBe("sainte foy les lyon");
  });
});

describe("titleCase", () => {
  it("met une majuscule à chaque mot sauf les mots de liaison", () => {
    expect(titleCase("SAINT-JACQUES-DE-LA-LANDE")).toBe("Saint-Jacques-de-la-Lande");
    expect(titleCase("LE RHEU")).toBe("Le Rheu");
    expect(titleCase("BD ALBERT 1ER")).toBe("Bd Albert 1er");
  });
});

describe("splitStreet", () => {
  it("sépare le numéro de la rue", () => {
    expect(splitStreet("12 Boulevard Albert 1er")).toEqual({
      number: "12",
      street: "Boulevard Albert 1er",
    });
    expect(splitStreet("12, BD ALBERT 1ER")).toEqual({ number: "12", street: "Bd Albert 1er" });
    expect(splitStreet("09 BIS SQU LOUIS ARMAND")).toEqual({
      number: "9 bis",
      street: "Squ Louis Armand",
    });
    expect(splitStreet("13 b Avenue de Cucillé")).toEqual({
      number: "13 b",
      street: "Avenue de Cucillé",
    });
  });

  it("garde tout dans la rue sans numéro en tête", () => {
    expect(splitStreet("Rennes ASPTT, Rue Pierre Nougaro")).toEqual({
      number: null,
      street: "Rennes ASPTT, Rue Pierre Nougaro",
    });
    expect(splitStreet("12 Avenue")).toEqual({ number: "12", street: "Avenue" });
  });

  it("rend null pour une adresse vide", () => {
    expect(splitStreet("  ")).toEqual({ number: null, street: null });
    expect(splitStreet(null)).toEqual({ number: null, street: null });
  });
});

describe("searchFfbbClubs", () => {
  it("garde les clubs de la ville, clubs d'abord puis unions et ententes", async () => {
    const { fetchJson, paths } = fakeFetch(
      searchResponse([
        organisme("200000002675746", "EN-RENNES PA / RENNES STADE", "RENNES", {
          association: "Entente",
        }),
        organisme(9668, "RENNES STADE BASKETBALL", "RENNES", { postalCode: "35200" }),
        organisme("86001065675", "UNION RENNES PACE BASKET 35", "RENNES", {
          association: "Union",
        }),
        organisme(9657, "RENNES AS CHEMINOTS", "RENNES"),
        organisme("200000002676325", "EN-CHANTEPIE/CHATEAUGIRON", "CHANTEPIE", {
          association: "Entente",
        }),
        organisme(2061, "COMITE D'ILLE-ET-VILAINE DE BASKET-BALL", "RENNES", { type: "Comité" }),
        { id: "bad" },
      ]),
    );

    const result = await searchFfbbClubs(fetchJson, " Rennes ");

    expect(paths).toEqual(["/search?query=rennes"]);
    expect(result).toEqual({
      ok: true,
      value: [
        {
          id: "9657",
          name: "RENNES AS CHEMINOTS",
          city: "Rennes",
          postalCode: "35000",
          kind: "club",
        },
        {
          id: "9668",
          name: "RENNES STADE BASKETBALL",
          city: "Rennes",
          postalCode: "35200",
          kind: "club",
        },
        {
          id: "86001065675",
          name: "UNION RENNES PACE BASKET 35",
          city: "Rennes",
          postalCode: "35000",
          kind: "union",
        },
        {
          id: "200000002675746",
          name: "EN-RENNES PA / RENNES STADE",
          city: "Rennes",
          postalCode: "35000",
          kind: "entente",
        },
      ],
    });
  });

  it("couvre les arrondissements d'une ville", async () => {
    const { fetchJson } = fakeFetch(
      searchResponse([
        organisme(1, "BEDEE PLEUMELEUC BASKET", "PLEUMELEUC"),
        organisme(2, "PARIS BASKET 13", "PARIS 13E ARRONDISSEMENT", { postalCode: "75013" }),
        organisme(3, "PARISIS BASKET", "SANNOIS"),
      ]),
    );

    const result = await searchFfbbClubs(fetchJson, "Paris");

    expect(result.ok && result.value.map((hit) => [hit.id, hit.city])).toEqual([["2", "Paris"]]);
  });

  it("place après les clubs de la ville ceux qui portent seulement son nom", async () => {
    const { fetchJson, paths } = fakeFetch(
      searchResponse([
        organisme(1, "BEDEE PLEUMELEUC BASKET", "PLEUMELEUC"),
        organisme(2, "AS BEDEE", "BEDEE"),
      ]),
    );

    const result = await searchFfbbClubs(fetchJson, "Bédée");

    expect(paths).toEqual(["/search?query=bedee"]);
    expect(result.ok && result.value.map((hit) => hit.id)).toEqual(["2", "1"]);
  });

  it("n'interroge pas l'API pour moins de deux caractères", async () => {
    const { fetchJson, paths } = fakeFetch(searchResponse([]));
    expect(await searchFfbbClubs(fetchJson, " x ")).toEqual({ ok: true, value: [] });
    expect(paths).toEqual([]);
  });

  it("signale une panne ou une réponse inattendue", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await searchFfbbClubs(failingFetch, "Rennes")).toEqual({ ok: false });
    expect(await searchFfbbClubs(fakeFetch({ error: "x" }).fetchJson, "Rennes")).toEqual({
      ok: false,
    });
  });
});

describe("getFfbbClub", () => {
  it("prend l'adresse de la salle principale", async () => {
    const { fetchJson, paths } = fakeFetch({
      nom: "RENNES STADE BASKETBALL",
      adresse: "12, BD ALBERT 1ER",
      commune: { codePostal: "35200", libelle: "RENNES" },
      salle: {
        libelle: "SALLE COLETTE BESSON",
        adresse: "12 Boulevard Albert 1er",
        commune: { codePostal: "35200", libelle: "RENNES" },
      },
    });

    expect(await getFfbbClub(fetchJson, "9668")).toEqual({
      ok: true,
      value: {
        name: "RENNES STADE BASKETBALL",
        venue: "SALLE COLETTE BESSON",
        number: "12",
        street: "Boulevard Albert 1er",
        postalCode: "35200",
        city: "Rennes",
      },
    });
    expect(paths).toEqual(["/club/9668"]);
  });

  it("se rabat sur l'adresse du club sans salle exploitable", async () => {
    const { fetchJson } = fakeFetch({
      nom: "RENNES AS CHEMINOTS",
      adresse: "09 BIS SQU LOUIS ARMAND",
      commune: { codePostal: "35000", libelle: "RENNES" },
      salle: null,
    });

    expect(await getFfbbClub(fetchJson, "9657")).toEqual({
      ok: true,
      value: {
        name: "RENNES AS CHEMINOTS",
        venue: null,
        number: "9 bis",
        street: "Squ Louis Armand",
        postalCode: "35000",
        city: "Rennes",
      },
    });
  });

  it("rend un code postal null s'il n'est pas valable", async () => {
    const { fetchJson } = fakeFetch({ nom: "CLUB X", adresse: null, commune: null });
    const result = await getFfbbClub(fetchJson, "1");
    expect(result.ok && result.value.postalCode).toBeNull();
  });

  it("signale une panne ou une réponse inattendue", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await getFfbbClub(failingFetch, "1")).toEqual({ ok: false });
    expect(await getFfbbClub(fakeFetch({ detail: "Not found" }).fetchJson, "1")).toEqual({
      ok: false,
    });
  });
});
