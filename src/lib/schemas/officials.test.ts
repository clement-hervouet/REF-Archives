import { describe, expect, it } from "vitest";
import {
  findOfficialsIssues,
  newColleagueSchema,
  officialsSchema,
  type Officials,
} from "./officials";

const PERSON_A = "3c1d2e4f-5a6b-4c7d-8e9f-0a1b2c3d4e01";
const PERSON_B = "3c1d2e4f-5a6b-4c7d-8e9f-0a1b2c3d4e02";

const NONE = { kind: "none" } as const;
const SELF = { kind: "self" } as const;
const existing = (personId: string) => ({ kind: "existing", personId }) as const;

function officials(overrides: Partial<Officials> = {}): Officials {
  return { referee1: SELF, referee2: NONE, referee3: NONE, observer: NONE, ...overrides };
}

/**
 * Erreurs du schéma sous la forme « place:code ». `unknown` : le schéma reçoit une saisie
 * brute (prénom en chaîne), alors que `officials()` construit la forme validée (prénom `null`).
 */
function schemaIssues(input: unknown): string[] {
  const result = officialsSchema.safeParse(input);
  if (result.success) {
    return [];
  }
  return result.error.issues.map((issue) => `${String(issue.path[0])}:${issue.message}`);
}

describe("findOfficialsIssues", () => {
  it("accepte l'utilisateur seul arbitre 1", () => {
    expect(findOfficialsIssues(officials())).toEqual([]);
  });

  it("accepte l'utilisateur à n'importe quelle place", () => {
    expect(
      findOfficialsIssues(officials({ referee1: existing(PERSON_A), referee2: SELF })),
    ).toEqual([]);
    expect(
      findOfficialsIssues(
        officials({ referee1: existing(PERSON_A), referee2: existing(PERSON_B), referee3: SELF }),
      ),
    ).toEqual([]);
    expect(
      findOfficialsIssues(officials({ referee1: existing(PERSON_A), observer: SELF })),
    ).toEqual([]);
  });

  it("accepte un trio complet avec observateur", () => {
    const colleague = {
      kind: "new",
      colleague: { firstname: null, lastname: "Durand", hasAccount: false },
    } as const;
    expect(
      findOfficialsIssues({
        referee1: existing(PERSON_A),
        referee2: SELF,
        referee3: existing(PERSON_B),
        observer: colleague,
      }),
    ).toEqual([]);
  });

  it("exige un arbitre 1", () => {
    expect(findOfficialsIssues(officials({ referee1: NONE, referee2: SELF }))).toEqual([
      { slot: "referee1", code: "referee1_required" },
    ]);
  });

  it("refuse un arbitre 3 sans arbitre 2", () => {
    expect(findOfficialsIssues(officials({ referee3: existing(PERSON_A) }))).toEqual([
      { slot: "referee3", code: "referee3_without_referee2" },
    ]);
  });

  it("exige que l'utilisateur occupe une place", () => {
    expect(findOfficialsIssues(officials({ referee1: existing(PERSON_A) }))).toEqual([
      { slot: "referee1", code: "self_missing" },
    ]);
  });

  it("refuse l'utilisateur à deux places, signalé sur la seconde", () => {
    expect(findOfficialsIssues(officials({ observer: SELF }))).toEqual([
      { slot: "observer", code: "self_twice" },
    ]);
  });

  it("refuse un collègue à deux places, signalé sur la seconde", () => {
    expect(
      findOfficialsIssues(officials({ referee2: existing(PERSON_A), observer: existing(PERSON_A) })),
    ).toEqual([{ slot: "observer", code: "person_twice" }]);
  });

  it("cumule plusieurs erreurs", () => {
    expect(
      findOfficialsIssues({
        referee1: NONE,
        referee2: NONE,
        referee3: existing(PERSON_A),
        observer: existing(PERSON_A),
      }),
    ).toEqual([
      { slot: "referee1", code: "referee1_required" },
      { slot: "referee3", code: "referee3_without_referee2" },
      { slot: "observer", code: "person_twice" },
      { slot: "referee1", code: "self_missing" },
    ]);
  });
});

describe("newColleagueSchema", () => {
  it("nettoie la saisie et rend le prénom facultatif", () => {
    expect(
      newColleagueSchema.parse({ firstname: "  ", lastname: " Martin ", hasAccount: true }),
    ).toEqual({ firstname: null, lastname: "Martin", hasAccount: true });
    expect(
      newColleagueSchema.parse({ firstname: "Alex", lastname: "Martin", hasAccount: false }),
    ).toEqual({ firstname: "Alex", lastname: "Martin", hasAccount: false });
  });

  it("refuse un nom vide, trop long ou avec caractère de contrôle", () => {
    for (const lastname of ["", "   ", "x".repeat(101), "Mar\ntin", "Mar\u0000tin"]) {
      expect(
        newColleagueSchema.safeParse({ firstname: "", lastname, hasAccount: false }).success,
      ).toBe(false);
    }
  });

  it("accepte un nom de 100 caractères", () => {
    expect(
      newColleagueSchema.safeParse({ firstname: "", lastname: "x".repeat(100), hasAccount: false })
        .success,
    ).toBe(true);
  });

  it("refuse une case « a un compte » qui n'est pas un booléen", () => {
    expect(
      newColleagueSchema.safeParse({ firstname: "", lastname: "Martin", hasAccount: "on" }).success,
    ).toBe(false);
  });
});

describe("officialsSchema", () => {
  it("accepte une composition valide", () => {
    expect(schemaIssues(officials({ referee2: existing(PERSON_A) }))).toEqual([]);
  });

  it("remonte les erreurs de composition sur la bonne place", () => {
    expect(schemaIssues(officials({ observer: SELF }))).toEqual(["observer:self_twice"]);
  });

  it("refuse un identifiant de personne mal formé ou un type de place inconnu", () => {
    expect(officialsSchema.safeParse(officials({ referee2: existing("42") })).success).toBe(false);
    expect(
      officialsSchema.safeParse({ ...officials(), referee2: { kind: "account", personId: PERSON_A } })
        .success,
    ).toBe(false);
  });
});
