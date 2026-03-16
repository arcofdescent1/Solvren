"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/ui/primitives/button";
import { applyTheme, getPreferredTheme, THEME_STORAGE_KEY, type ThemeMode } from "./theme";

export function ThemeToggle() {
  const [mode, setMode] = React.useState<ThemeMode>("light");

  React.useEffect(() => {
    const initial = getPreferredTheme();
    setMode(initial);
    applyTheme(initial);
  }, []);

  function toggle() {
    const next: ThemeMode = mode === "dark" ? "light" : "dark";
    setMode(next);
    window.localStorage.setItem(THEME_STORAGE_KEY, next);
    applyTheme(next);
  }

  return (
    <Button variant="secondary" size="icon" onClick={toggle} aria-label="Toggle theme">
      {mode === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
