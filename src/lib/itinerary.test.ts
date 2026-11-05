import { describe, expect, it } from "vitest";
import { itineraryUrl } from "./itinerary";

describe("itineraryUrl", () => {
  it("construit un lien Google Maps avec l'adresse encodée", () => {
    const url = new URL(itineraryUrl("2 Rue du Stade, 62400 Béthune"));
    expect(url.origin).toBe("https://www.google.com");
    expect(url.pathname).toBe("/maps/search/");
    expect(url.searchParams.get("api")).toBe("1");
    expect(url.searchParams.get("query")).toBe("2 Rue du Stade, 62400 Béthune");
  });

  it("ne laisse pas une adresse ajouter des paramètres", () => {
    const url = new URL(itineraryUrl("Rue A&api=2#x"));
    expect(url.searchParams.get("api")).toBe("1");
    expect(url.searchParams.get("query")).toBe("Rue A&api=2#x");
    expect(url.hash).toBe("");
  });
});
