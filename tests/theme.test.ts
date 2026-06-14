import { describe, it, expect } from "vitest";
import { normalizeTheme, THEMES, THEME_LABEL } from "@/lib/theme";

describe("normalizeTheme", () => {
  it("accepts the valid themes", () => {
    expect(normalizeTheme("light")).toBe("light");
    expect(normalizeTheme("dark")).toBe("dark");
    expect(normalizeTheme("system")).toBe("system");
  });

  it("defaults anything else to system", () => {
    expect(normalizeTheme(null)).toBe("system");
    expect(normalizeTheme(undefined)).toBe("system");
    expect(normalizeTheme("")).toBe("system");
    expect(normalizeTheme("blue")).toBe("system");
    expect(normalizeTheme("DARK")).toBe("system"); // case-sensitive by design
  });
});

describe("theme tables", () => {
  it("every theme has a label", () => {
    for (const t of THEMES) expect(THEME_LABEL[t]).toBeTruthy();
    expect(THEMES).toHaveLength(3);
  });
});
