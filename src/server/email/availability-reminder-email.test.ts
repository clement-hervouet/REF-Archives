import { describe, expect, it } from "vitest";
import { buildAvailabilityReminderEmail } from "./availability-reminder-email";

const input = {
  email: "clem@example.com",
  weekendSaturday: "2026-12-12",
  appUrl: "https://ref.example.com",
};

describe("buildAvailabilityReminderEmail", () => {
  it("cible l'utilisateur et date le weekend dans le sujet", () => {
    const message = buildAvailabilityReminderEmail(input);
    expect(message.to).toBe("clem@example.com");
    expect(message.subject).toBe("Saisissez vos indisponibilités du weekend du 12/12");
  });

  it("cite le samedi et le dimanche du weekend", () => {
    expect(buildAvailabilityReminderEmail(input).text).toContain(
      "samedi 12/12 et du dimanche 13/12",
    );
  });

  it("gère un weekend à cheval sur deux mois", () => {
    const message = buildAvailabilityReminderEmail({ ...input, weekendSaturday: "2027-01-30" });
    expect(message.text).toContain("samedi 30/01 et du dimanche 31/01");
  });

  it("renvoie vers la page des paramètres pour désactiver le rappel", () => {
    const message = buildAvailabilityReminderEmail(input);
    expect(message.text).toContain("https://ref.example.com/parametres");
    expect(message.html).toContain('href="https://ref.example.com/parametres"');
    expect(message.text).toContain("désactiver");
  });
});
