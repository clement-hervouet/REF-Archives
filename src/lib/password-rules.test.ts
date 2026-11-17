import { describe, expect, it } from "vitest";
import { evaluatePasswordRules } from "./password-rules";

describe("evaluatePasswordRules", () => {
  it("reste neutre tant que rien n'est saisi", () => {
    expect(evaluatePasswordRules("", "")).toEqual({
      length: "empty",
      notCommon: "empty",
      match: "empty",
    });
  });

  it("signale un mot de passe trop court sans juger s'il est courant", () => {
    expect(evaluatePasswordRules("abc", "")).toEqual({
      length: "ko",
      notCommon: "empty",
      match: "empty",
    });
  });

  it("valide la longueur à partir de 12 caractères", () => {
    expect(evaluatePasswordRules("x".repeat(11) + "y", "").length).toBe("ok");
    expect(evaluatePasswordRules("x".repeat(10) + "y", "").length).toBe("ko");
  });

  it("refuse un mot de passe courant ou un motif répété", () => {
    expect(evaluatePasswordRules("Password1234", "").notCommon).toBe("ko");
    expect(evaluatePasswordRules("abababababab", "").notCommon).toBe("ko");
    expect(evaluatePasswordRules("une phrase de passe", "").notCommon).toBe("ok");
  });

  it("compare la confirmation dès qu'elle est saisie", () => {
    expect(evaluatePasswordRules("une phrase de passe", "une phrase").match).toBe("ko");
    expect(evaluatePasswordRules("une phrase de passe", "une phrase de passe").match).toBe("ok");
  });
});
