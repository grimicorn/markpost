const STORAGE_KEY = "mp_theme";

export function useTheme() {
  const isDark = ref(false);

  const applyDark = (dark: boolean) => {
    isDark.value = dark;
    document.documentElement.classList.toggle("dark", dark);
  };

  const initTheme = () => {
    if (typeof window === "undefined") {
      return;
    }
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "dark" || stored === "light") {
      applyDark(stored === "dark");
      return;
    }
    applyDark(window.matchMedia("(prefers-color-scheme: dark)").matches);
  };

  const setTheme = (theme: "dark" | "light") => {
    localStorage.setItem(STORAGE_KEY, theme);
    applyDark(theme === "dark");
  };

  const toggleTheme = () => {
    setTheme(isDark.value ? "light" : "dark");
  };

  return { isDark, initTheme, setTheme, toggleTheme };
}
