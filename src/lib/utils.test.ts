import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("assemble les classes et ignore les valeurs fausses", () => {
    expect(cn("flex", false, undefined, "gap-2")).toBe("flex gap-2");
  });

  it("garde la dernière classe Tailwind en cas de conflit", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
  });
});
