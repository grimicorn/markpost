const STORAGE_KEY = "mp_theme";

export function useTheme() {
  const isDark = ref(false);

  const initTheme = () => {
    if (typeof window === "undefined") {
      return;
    }
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "dark") {
      isDark.value = true;
      document.documentElement.classList.add("dark");
    } else if (stored === "light") {
      isDark.value = false;
      document.documentElement.classList.remove("dark");
    } else {
      isDark.value = window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (isDark.value) {
        document.documentElement.classList.add("dark");
      }
    }
  };

  const setTheme = (theme: "dark" | "light") => {
    isDark.value = theme === "dark";
    localStorage.setItem(STORAGE_KEY, theme);
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  const toggleTheme = () => {
    setTheme(isDark.value ? "light" : "dark");
  };

  return { isDark, initTheme, setTheme, toggleTheme };
}
