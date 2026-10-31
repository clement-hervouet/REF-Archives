import { describe, expect, it } from "vitest";
import type { z } from "zod";
import { emailSchema, loginSchema, passwordSchema, tokenSchema } from "./auth";

function errorMessages(schema: z.ZodType, input: unknown): string[] {
  const result = schema.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

function parsed(schema: z.ZodType, input: unknown): unknown {
  const result = schema.safeParse(input);
  return result.success ? result.data : undefined;
}

describe("emailSchema", () => {
  it("accepte un email valide", () => {
    expect(parsed(emailSchema, "clem@example.com")).toBe("clem@example.com");
  });

  it("normalise les espaces et la casse", () => {
    expect(parsed(emailSchema, "  Clem@Example.COM ")).toBe("clem@example.com");
  });

  it("refuse un email sans @", () => {
    expect(errorMessages(emailSchema, "clem.example.com")).toContain("email.invalid");
  });

  it("refuse une chaîne vide", () => {
    expect(errorMessages(emailSchema, "")).toContain("email.invalid");
  });

  it("refuse un email de plus de 255 caractères", () => {
    const tooLong = `${"a".repeat(250)}@example.com`;
    expect(errorMessages(emailSchema, tooLong)).toContain("email.too_long");
  });

  it("refuse une valeur qui n'est pas une chaîne", () => {
    expect(errorMessages(emailSchema, 42)).toContain("email.invalid");
    expect(errorMessages(emailSchema, undefined)).toContain("email.invalid");
  });
});

describe("passwordSchema", () => {
  it("accepte une phrase de passe", () => {
    expect(errorMessages(passwordSchema, "correct horse battery staple")).toEqual([]);
  });

  it("accepte exactement 12 caractères non triviaux", () => {
    expect(errorMessages(passwordSchema, "Tr0ub4dor&3x")).toEqual([]);
  });

  it("refuse 11 caractères", () => {
    expect(errorMessages(passwordSchema, "Tr0ub4dor&3")).toContain("password.too_short");
  });

  it("accepte exactement 128 caractères", () => {
    // padEnd garantit la longueur exacte, quelle que soit la taille du préfixe.
    const value = "Tr0ub4dor&3-".padEnd(128, "xyz");
    expect(value).toHaveLength(128);
    expect(errorMessages(passwordSchema, value)).toEqual([]);
  });

  it("refuse plus de 128 caractères", () => {
    const value = "Tr0ub4dor&3-".padEnd(129, "xyz");
    expect(value).toHaveLength(129);
    expect(errorMessages(passwordSchema, value)).toContain("password.too_long");
  });

  it("refuse un mot de passe courant", () => {
    expect(errorMessages(passwordSchema, "Password1234")).toContain("password.too_common");
  });

  it("refuse un motif répété", () => {
    expect(errorMessages(passwordSchema, "abababababab")).toContain("password.too_common");
  });

  it("ne trim pas : les espaces font partie du mot de passe", () => {
    expect(parsed(passwordSchema, "  correct horse battery  ")).toBe("  correct horse battery  ");
  });

  it("refuse une valeur qui n'est pas une chaîne", () => {
    expect(errorMessages(passwordSchema, null)).toContain("password.invalid");
  });
});

describe("tokenSchema", () => {
  const valid = "A".repeat(42) + "b";

  it("accepte un jeton base64url de 43 caractères", () => {
    expect(errorMessages(tokenSchema, valid)).toEqual([]);
  });

  it("accepte les caractères - et _", () => {
    expect(errorMessages(tokenSchema, "-".repeat(21) + "_".repeat(22))).toEqual([]);
  });

  it("refuse un jeton trop court ou trop long", () => {
    expect(errorMessages(tokenSchema, valid.slice(1))).toContain("token.invalid");
    expect(errorMessages(tokenSchema, `${valid}A`)).toContain("token.invalid");
  });

  it("refuse les caractères hors base64url", () => {
    expect(errorMessages(tokenSchema, "A".repeat(42) + "+")).toContain("token.invalid");
    expect(errorMessages(tokenSchema, "A".repeat(42) + "=")).toContain("token.invalid");
    expect(errorMessages(tokenSchema, "A".repeat(42) + " ")).toContain("token.invalid");
  });

  it("refuse une valeur qui n'est pas une chaîne", () => {
    expect(errorMessages(tokenSchema, undefined)).toContain("token.invalid");
  });
});

describe("loginSchema", () => {
  it("accepte des identifiants bien formés et normalise l'email", () => {
    expect(parsed(loginSchema, { email: " Clem@Example.com ", password: "x" })).toEqual({
      email: "clem@example.com",
      password: "x",
    });
  });

  it("n'applique pas la politique de mot de passe à la connexion", () => {
    expect(errorMessages(loginSchema, { email: "clem@example.com", password: "court" })).toEqual(
      [],
    );
  });

  it("refuse un mot de passe vide", () => {
    expect(errorMessages(loginSchema, { email: "clem@example.com", password: "" })).toContain(
      "password.required",
    );
  });

  it("refuse un mot de passe de plus de 128 caractères", () => {
    expect(
      errorMessages(loginSchema, { email: "clem@example.com", password: "x".repeat(129) }),
    ).toContain("password.too_long");
  });

  it("refuse un objet incomplet", () => {
    expect(errorMessages(loginSchema, {})).not.toEqual([]);
  });
});