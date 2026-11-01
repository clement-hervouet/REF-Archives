import { describe, expect, it } from "vitest";
import { UNKNOWN_IP, getClientIp } from "./client-ip";

describe("getClientIp", () => {
  it("lit X-Forwarded-For", () => {
    expect(getClientIp(new Headers({ "x-forwarded-for": "203.0.113.7" }))).toBe("203.0.113.7");
  });

  it("prend la première adresse d'une liste et ignore les espaces", () => {
    const headers = new Headers({ "x-forwarded-for": " 203.0.113.7 , 10.0.0.1" });
    expect(getClientIp(headers)).toBe("203.0.113.7");
  });

  it("accepte une adresse IPv6", () => {
    expect(getClientIp(new Headers({ "x-forwarded-for": "2001:db8::1" }))).toBe("2001:db8::1");
  });

  it("se rabat sur X-Real-IP quand X-Forwarded-For est invalide", () => {
    const headers = new Headers({ "x-forwarded-for": "pas-une-ip", "x-real-ip": "198.51.100.4" });
    expect(getClientIp(headers)).toBe("198.51.100.4");
  });

  it("utilise X-Real-IP seul", () => {
    expect(getClientIp(new Headers({ "x-real-ip": "198.51.100.4" }))).toBe("198.51.100.4");
  });

  it("renvoie la valeur par défaut sans en-tête", () => {
    expect(getClientIp(new Headers())).toBe(UNKNOWN_IP);
  });

  it("rejette une valeur qui n'est pas une adresse IP", () => {
    expect(getClientIp(new Headers({ "x-forwarded-for": "<script>alert(1)</script>" }))).toBe(
      UNKNOWN_IP,
    );
  });
});