import { describe, expect, it } from "vitest";
import { departmentOf, matchClub, significantWords } from "./club-matching";
import type { FfbbClubCandidate } from "./ffbb-clubs";

function candidate(
  id: string,
  name: string,
  postalCode: string | null,
  city: string | null = null,
): FfbbClubCandidate {
  return {
    id,
    name,
    city,
    postalCode,
    kind: "club",
    ffbb: { id, logoUuid: null, color: null },
  };
}

const RENNES = { name: "RENNES AVENIR", postalCode: "35000", city: "Rennes" };

describe("departmentOf", () => {
  it("rend le département, sur trois chiffres en outre-mer", () => {
    expect(departmentOf("35200")).toBe("35");
    expect(departmentOf("20090")).toBe("20");
    expect(departmentOf("97400")).toBe("974");
    expect(departmentOf("B-1000")).toBeNull();
    expect(departmentOf(null)).toBeNull();
  });
});

describe("significantWords", () => {
  it("ignore accents, ordre et mots courants", () => {
    expect(significantWords("BC BÉTHUNE")).toBe("bethune");
    expect(significantWords("Béthune Basket Club")).toBe("bethune");
    expect(significantWords("ST GREGOIRE BASKET")).toBe("gregoire saint");
  });
});

describe("matchClub", () => {
  it("retrouve un club de l'annuaire à son nom exact, même si sa salle change de code postal", () => {
    const match = matchClub({ ...RENNES, postalCode: "35200" }, [
      candidate("1", "RENNES AVENIR", "35000"),
      candidate("2", "RENNES PA BASKET", "35000"),
    ]);
    expect(match).toMatchObject({ status: "found", level: "name", candidate: { id: "1" } });
  });

  it("se rabat sur les mots significatifs", () => {
    const match = matchClub({ name: "BC BÉTHUNE", postalCode: "62400", city: null }, [
      candidate("1", "BETHUNE BASKET CLUB", "62400"),
      candidate("2", "ES LENS", "62300"),
    ]);
    expect(match).toMatchObject({ status: "found", level: "words", candidate: { id: "1" } });
  });

  it("écarte un club du même nom dans un autre département", () => {
    expect(matchClub(RENNES, [candidate("1", "RENNES AVENIR", "44000")])).toEqual({
      status: "not_found",
    });
  });

  it("compare la ville quand la FFBB ne donne pas de code postal", () => {
    expect(matchClub(RENNES, [candidate("1", "RENNES AVENIR", null, "Rennes")])).toMatchObject({
      status: "found",
    });
    expect(matchClub(RENNES, [candidate("1", "RENNES AVENIR", null, "Brest")])).toEqual({
      status: "not_found",
    });
  });

  it("ne lie rien quand plusieurs clubs correspondent", () => {
    const match = matchClub({ name: "BC VANNES", postalCode: "56000", city: null }, [
      candidate("1", "VANNES BASKET CLUB", "56000"),
      candidate("2", "BASKET CLUB VANNES", "56000"),
    ]);
    expect(match.status).toBe("ambiguous");
  });

  it("ne lie rien sur des mots courants seuls", () => {
    expect(
      matchClub({ name: "BASKET CLUB", postalCode: "56000", city: null }, [
        candidate("1", "BC", "56000"),
      ]),
    ).toEqual({ status: "not_found" });
  });
});
