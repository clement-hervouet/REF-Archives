import { describe, expect, it } from "vitest";
import { isAuthorizedCronRequest } from "./cron-auth";

const SECRET = "s".repeat(32);

describe("isAuthorizedCronRequest", () => {
  it("accepte le bon secret", () => {
    expect(isAuthorizedCronRequest(`Bearer ${SECRET}`, SECRET)).toBe(true);
  });

  it("refuse un en-tête absent ou vide", () => {
    expect(isAuthorizedCronRequest(null, SECRET)).toBe(false);
    expect(isAuthorizedCronRequest("", SECRET)).toBe(false);
    expect(isAuthorizedCronRequest("Bearer ", SECRET)).toBe(false);
  });

  it("refuse un mauvais secret, y compris un préfixe ou un suffixe du bon", () => {
    expect(isAuthorizedCronRequest(`Bearer ${"t".repeat(32)}`, SECRET)).toBe(false);
    expect(isAuthorizedCronRequest(`Bearer ${SECRET.slice(1)}`, SECRET)).toBe(false);
    expect(isAuthorizedCronRequest(`Bearer ${SECRET}x`, SECRET)).toBe(false);
  });

  it("refuse un autre schéma ou un format approximatif", () => {
    expect(isAuthorizedCronRequest(`Basic ${SECRET}`, SECRET)).toBe(false);
    expect(isAuthorizedCronRequest(SECRET, SECRET)).toBe(false);
    expect(isAuthorizedCronRequest(`bearer ${SECRET}`, SECRET)).toBe(false);
    expect(isAuthorizedCronRequest(`Bearer ${SECRET} extra`, SECRET)).toBe(false);
  });
});
