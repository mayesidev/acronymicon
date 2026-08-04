import { useEffect } from "react";

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
    <button
      type="button"
      onClick={toggleTheme}
      className="fixed bottom-4 right-4 z-10 rounded border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-100"
      aria-label="Toggle color theme"
      title="Toggle color theme"
    >
      Theme
    </button>
  );
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}
