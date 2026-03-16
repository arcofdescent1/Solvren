"use client";;
import { Button } from "@/ui";

import * as React from "react";

function getCurrentTheme(): "light" | "dark" {
  const t = document.documentElement.getAttribute("data-theme");
  return t === "dark" ? "dark" : "light";
}

export default function ThemeToggle() {
  const [theme, setTheme] = React.useState<"light" | "dark">("light");

  React.useEffect(() => {
    try {
      setTheme(getCurrentTheme());
    } catch {
      // ignore
    }
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("theme", next);
    } catch {
      // ignore
    }
  }

  return (
    <Button
      type="button"
      onClick={toggle}
      className="inline-flex items-center justify-center h-9 w-9 rounded-[var(--rg-radius)] border border-[color:var(--rg-border)] bg-[color:var(--rg-panel)] text-[color:var(--rg-text)] shadow-[var(--rg-shadow-sm)] hover:shadow-[var(--rg-shadow)] transition"
      aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      title={theme === "dark" ? "Light mode" : "Dark mode"}
    >
      <span aria-hidden className="text-[14px]">
        {theme === "dark" ? "☀️" : "🌙"}
      </span>
    </Button>
  );
}
