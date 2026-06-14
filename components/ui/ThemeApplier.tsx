"use client";

import { useEffect } from "react";
import { applyTheme, readTheme } from "@/lib/theme";

// Applies the stored theme on load (renders nothing). Kept always-mounted so the
// theme survives even though the toggle now lives inside the user menu, which is
// unmounted until opened.
export function ThemeApplier() {
  useEffect(() => {
    applyTheme(readTheme());
  }, []);
  return null;
}
