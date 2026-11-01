import { describe, expect, it } from "vitest";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";
import { assertAdmin } from "./authorization";
import type { CurrentUser } from "./current-user";

const BASE_USER: CurrentUser = {
  id: "3f0c1d52-9b0a-4c55-8a3e-2f6f3a1c9e11",
  sessionId: "9d6c2f4e-1b7a-4e0c-9a55-0c2d7f1e8b33",
  email: "clem@example.com",
  role: "admin",
};

describe("assertAdmin", () => {
  it("renvoie l'utilisateur quand il est administrateur", () => {
    expect(assertAdmin(BASE_USER)).toBe(BASE_USER);
  });

  it("lève UnauthorizedError quand personne n'est connecté", () => {
    expect(() => assertAdmin(null)).toThrow(UnauthorizedError);
  });

  it("lève ForbiddenError pour un utilisateur simple", () => {
    expect(() => assertAdmin({ ...BASE_USER, role: "user" })).toThrow(ForbiddenError);
  });

  it("ne confond pas non connecté et non autorisé", () => {
    expect(() => assertAdmin(null)).not.toThrow(ForbiddenError);
    expect(() => assertAdmin({ ...BASE_USER, role: "user" })).not.toThrow(UnauthorizedError);
  });
});