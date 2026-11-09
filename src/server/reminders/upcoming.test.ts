import { describe, expect, it } from "vitest";
import { groupByWeek, relativeDay, upcomingRanges } from "./upcoming";

describe("upcomingRanges", () => {
  it("affiche le weekend de la semaine en cours, puis 8 semaines", () => {
    expect(upcomingRanges("2026-11-05")).toEqual({
      saturday: "2026-11-07",
      weekend: {
        from: new Date("2026-11-05T23:00:00.000Z"),
        to: new Date("2026-11-08T23:00:00.000Z"),
      },
      later: {
        from: new Date("2026-11-08T23:00:00.000Z"),
        // Lundi 04/01/2027 00:00 à Paris.
        to: new Date("2027-01-03T23:00:00.000Z"),
      },
    });
  });

  it("le dimanche, garde le weekend qui se termine", () => {
    expect(upcomingRanges("2026-11-08").saturday).toBe("2026-11-07");
  });

  it("le lundi, passe au weekend suivant", () => {
    expect(upcomingRanges("2026-11-09").saturday).toBe("2026-11-14");
  });
});

describe("relativeDay", () => {
  it("dit aujourd'hui, demain, ou dans N jours, selon le jour de Paris", () => {
    expect(relativeDay("2026-11-06", new Date("2026-11-06T19:00:00Z"))).toEqual({ kind: "today" });
    expect(relativeDay("2026-11-06", new Date("2026-11-07T18:00:00Z"))).toEqual({
      kind: "tomorrow",
    });
    expect(relativeDay("2026-11-06", new Date("2026-11-14T18:00:00Z"))).toEqual({
      kind: "days",
      days: 8,
    });
  });

  it("prend le jour de Paris : 23h30 UTC le 06/11 est déjà le 07/11", () => {
    expect(relativeDay("2026-11-06", new Date("2026-11-06T23:30:00Z"))).toEqual({
      kind: "tomorrow",
    });
  });

  it("ne donne pas de libellé à un match passé", () => {
    expect(relativeDay("2026-11-07", new Date("2026-11-06T19:00:00Z"))).toEqual({ kind: "past" });
  });
});

describe("groupByWeek", () => {
  it("regroupe par semaine du lundi au dimanche et saute les semaines vides", () => {
    const matches = [
      { id: "a", startsAt: new Date("2026-11-14T18:00:00Z") }, // samedi 14/11
      { id: "b", startsAt: new Date("2026-11-15T14:00:00Z") }, // dimanche 15/11
      { id: "c", startsAt: new Date("2026-11-28T18:00:00Z") }, // samedi 28/11
    ];
    expect(groupByWeek(matches)).toEqual([
      { monday: "2026-11-09", sunday: "2026-11-15", matches: [matches[0], matches[1]] },
      { monday: "2026-11-23", sunday: "2026-11-29", matches: [matches[2]] },
    ]);
  });

  it("classe un match du dimanche soir dans sa semaine, à l'heure de Paris", () => {
    // Dimanche 15/11 23:30 à Paris = 22:30 UTC.
    const [group] = groupByWeek([{ startsAt: new Date("2026-11-15T22:30:00Z") }]);
    expect(group?.monday).toBe("2026-11-09");
  });

  it("renvoie une liste vide sans match", () => {
    expect(groupByWeek([])).toEqual([]);
  });
});
