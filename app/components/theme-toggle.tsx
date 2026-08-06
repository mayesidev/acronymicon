import { useEffect } from "react";

import { Button } from "../ui/components/button";

type Theme = "light" | "dark";

const themeStorageKey = "acronymicon-theme";

export function ThemeToggle() {
  useEffect(() => {
    const storedTheme = window.localStorage.getItem(themeStorageKey);
    const mediaQuery =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-color-scheme: dark)")
        : null;
    const initialTheme: Theme =
      storedTheme === "dark" || storedTheme === "light"
        ? storedTheme
        : mediaQuery?.matches
          ? "dark"
          : "light";

    applyTheme(initialTheme);

    if (storedTheme) {
      return;
    }

    const handleSystemThemeChange = (event: MediaQueryListEvent) => {
      const nextTheme = event.matches ? "dark" : "light";
      applyTheme(nextTheme);
    };

    mediaQuery?.addEventListener("change", handleSystemThemeChange);
    return () =>
      mediaQuery?.removeEventListener("change", handleSystemThemeChange);
  }, []);

  function toggleTheme() {
    const nextTheme: Theme = document.documentElement.classList.contains("dark")
      ? "light"
      : "dark";
    window.localStorage.setItem(themeStorageKey, nextTheme);
    applyTheme(nextTheme);
  }

  return (
    <Button
      type="button"
      variant="secondary"
      onClick={toggleTheme}
      className="fixed right-4 bottom-4 z-10 px-3 text-xs"
      aria-label="Toggle color theme"
      title="Toggle color theme"
    >
      Theme
    </Button>
  );
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}
