// Theme handling shared by the load-time applier (ThemeApplier) and the in-menu
// control (DarkModeToggle). "system" follows the OS via the absence of an
// explicit data-theme attribute (globals.css handles the media query).

export type Theme = "light" | "dark" | "system";

export const THEMES: Theme[] = ["light", "dark", "system"];

export const THEME_LABEL: Record<Theme, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

// Pure: coerce any stored/raw value to a valid Theme (defaults to "system").
export function normalizeTheme(raw: string | null | undefined): Theme {
  return raw === "light" || raw === "dark" || raw === "system" ? raw : "system";
}

// Apply a theme to <html>. "system" clears the override so the OS preference wins.
export function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  if (theme === "system") el.removeAttribute("data-theme");
  else el.setAttribute("data-theme", theme);
}

export function readTheme(): Theme {
  if (typeof localStorage === "undefined") return "system";
  try {
    return normalizeTheme(localStorage.getItem("theme"));
  } catch {
    return "system";
  }
}

// Persist + apply a theme choice.
export function saveTheme(theme: Theme): void {
  try {
    localStorage.setItem("theme", theme);
  } catch {
    // private mode / storage disabled — apply for the session anyway
  }
  applyTheme(theme);
}
