"use client";

import { useEffect, useState } from "react";
import { type Theme, THEMES, THEME_LABEL, readTheme, saveTheme } from "@/lib/theme";
import { cn } from "@/lib/format";

// In-menu theme control: a Light / Dark / System segmented selector. Lives inside
// the user menu (see UserMenu). Load-time application is handled by ThemeApplier.
export function DarkModeToggle() {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    setTheme(readTheme());
  }, []);

  function choose(t: Theme) {
    setTheme(t);
    saveTheme(t);
  }

  return (
    <div role="group" aria-label="Theme" className="flex gap-1">
      {THEMES.map((t) => {
        const active = theme === t;
        return (
          <button
            key={t}
            type="button"
            onClick={() => choose(t)}
            aria-pressed={active}
            className={cn(
              "flex-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
              active ? "text-white" : "text-muted hover:text-ink"
            )}
            style={
              active
                ? { backgroundColor: "#185FA5" }
                : { border: "0.5px solid var(--border)" }
            }
          >
            {THEME_LABEL[t]}
          </button>
        );
      })}
    </div>
  );
}
