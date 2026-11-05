import { describe, expect, it } from "vitest";
import { type WeekendMatch, buildWeekendRecapEmail, weekendMatchLine } from "./weekend-recap-email";

const match: WeekendMatch = {
  startsAt: new Date("2026-11-07T19:30:00Z"),
  team1Name: "BC Béthune",
  team2Name: "ES Lens",
  division: { category: "Regional", type: "Feminin", level: "U15" },
  address: { street: "Rue du Stade", number: "2", postalCode: "62400", city: "Béthune" },
};

const input = {
  email: "clem@example.com",
  saturday: "2026-11-07",
  matches: [match],
  appUrl: "https://ref.example.com",
};

describe("weekendMatchLine", () => {
  it("donne l'heure de Paris, les équipes, le niveau et l'adresse", () => {
    const line = weekendMatchLine(match);
    expect(line).toMatch(/^samedi 07\/11 à 20:30 : BC Béthune – ES Lens \(.+\), /);
    expect(line).toContain("U15");
    expect(line).toContain("2 Rue du Stade, 62400 Béthune");
  });
});

describe("buildWeekendRecapEmail", () => {
  it("date le weekend dans le sujet, sans nom d'équipe", () => {
    const message = buildWeekendRecapEmail(input);
    expect(message.to).toBe("clem@example.com");
    expect(message.subject).toBe("Vos matchs du weekend du 07/11");
    expect(message.subject).not.toContain("Béthune");
  });

  it("accorde l'introduction au nombre de matchs", () => {
    expect(buildWeekendRecapEmail(input).text).toContain("1 match est prévu ce weekend");
    const two = buildWeekendRecapEmail({ ...input, matches: [match, match] });
    expect(two.text).toContain("2 matchs sont prévus ce weekend");
  });

  it("liste chaque match et renvoie vers la page « À venir »", () => {
    const message = buildWeekendRecapEmail(input);
    expect(message.text).toContain("BC Béthune – ES Lens");
    expect(message.html).toContain('href="https://ref.example.com/a-venir"');
  });

  it("échappe les données saisies par l'utilisateur dans le HTML", () => {
    const hostile = { ...match, team1Name: '<img src=x onerror="alert(1)">' };
    const message = buildWeekendRecapEmail({ ...input, matches: [hostile] });
    expect(message.html).not.toContain("<img");
    expect(message.html).toContain("&lt;img");
  });
});
