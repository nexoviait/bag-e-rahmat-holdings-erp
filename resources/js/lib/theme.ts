import { useEffect, useState } from "react";

export type Theme = "dark" | "light";

const STORAGE_KEY = "theme";

function readInitialTheme(): Theme {
  return document.documentElement.classList.contains("light") ? "light" : "dark";
}

function persist(theme: Theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Private browsing / blocked storage — the choice just won't survive a reload.
  }
}

/**
 * Reflects/controls the `.light` class the inline bootstrap script in
 * welcome.blade.php already applies before first paint (to avoid a
 * flash-of-wrong-theme) — this hook keeps React and localStorage in sync
 * with it after mount.
 */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(readInitialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle("light", theme === "light");
    persist(theme);
  }, [theme]);

  return {
    theme,
    toggleTheme: () => setTheme((t) => (t === "light" ? "dark" : "light")),
  };
}
