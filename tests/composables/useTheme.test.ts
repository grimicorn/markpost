import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  STORAGE_KEY_ACCENT,
  DEFAULT_ACCENT,
  CSS_VAR_ACCENT,
} from "../../app/composables/useTheme";

const storageMock: Record<string, string> = {};

const localStorageMock = {
  getItem: vi.fn((key: string) => storageMock[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    storageMock[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete storageMock[key];
  }),
};

const setPropertyMock = vi.fn();

Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  writable: true,
});

Object.defineProperty(globalThis, "document", {
  value: {
    documentElement: {
      classList: { toggle: vi.fn(), contains: vi.fn() },
      style: { setProperty: setPropertyMock },
    },
  },
  writable: true,
});

Object.defineProperty(globalThis, "window", {
  value: {
    matchMedia: vi.fn(() => ({ matches: false })),
  },
  writable: true,
});

beforeEach(() => {
  Object.keys(storageMock).forEach((key) => delete storageMock[key]);
  vi.clearAllMocks();
});

describe("useTheme — accent", () => {
  it("applyAccent sets the CSS variable on document.documentElement", async () => {
    const { useTheme } = await import("../../app/composables/useTheme");
    const { applyAccent } = useTheme();
    applyAccent("#6366f1");
    expect(setPropertyMock).toHaveBeenCalledWith(CSS_VAR_ACCENT, "#6366f1");
  });

  it("initAccent reads from localStorage when stored", async () => {
    storageMock[STORAGE_KEY_ACCENT] = "#0e9f6e";
    const { useTheme } = await import("../../app/composables/useTheme");
    const { initAccent } = useTheme();
    initAccent();
    expect(setPropertyMock).toHaveBeenCalledWith(CSS_VAR_ACCENT, "#0e9f6e");
  });

  it("initAccent falls back to DEFAULT_ACCENT when localStorage is empty", async () => {
    const { useTheme } = await import("../../app/composables/useTheme");
    const { initAccent } = useTheme();
    initAccent();
    expect(setPropertyMock).toHaveBeenCalledWith(
      CSS_VAR_ACCENT,
      DEFAULT_ACCENT,
    );
  });

  it("persistAccentLocally writes to localStorage and applies the CSS var", async () => {
    const { useTheme } = await import("../../app/composables/useTheme");
    const { persistAccentLocally } = useTheme();
    persistAccentLocally("#ea580c");
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      STORAGE_KEY_ACCENT,
      "#ea580c",
    );
    expect(setPropertyMock).toHaveBeenCalledWith(CSS_VAR_ACCENT, "#ea580c");
  });
});

describe("useTheme — theme choice persistence", () => {
  it("persistThemeChoiceLocally writes the choice key to localStorage", async () => {
    const { useTheme, STORAGE_KEY_THEME_CHOICE } =
      await import("../../app/composables/useTheme");
    const { persistThemeChoiceLocally } = useTheme();
    persistThemeChoiceLocally("dark");
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      STORAGE_KEY_THEME_CHOICE,
      "dark",
    );
  });

  it("getStoredThemeChoice returns the stored value", async () => {
    const { useTheme, STORAGE_KEY_THEME_CHOICE } =
      await import("../../app/composables/useTheme");
    storageMock[STORAGE_KEY_THEME_CHOICE] = "system";
    const { getStoredThemeChoice } = useTheme();
    expect(getStoredThemeChoice()).toBe("system");
  });

  it("getStoredThemeChoice returns null when nothing is stored", async () => {
    const { useTheme } = await import("../../app/composables/useTheme");
    const { getStoredThemeChoice } = useTheme();
    expect(getStoredThemeChoice()).toBeNull();
  });

  it("getStoredAccent returns the stored accent hex", async () => {
    const { useTheme, STORAGE_KEY_ACCENT: KEY } =
      await import("../../app/composables/useTheme");
    storageMock[KEY] = "#0e9f6e";
    const { getStoredAccent } = useTheme();
    expect(getStoredAccent()).toBe("#0e9f6e");
  });

  it("getStoredAccent returns null when nothing is stored", async () => {
    const { useTheme } = await import("../../app/composables/useTheme");
    const { getStoredAccent } = useTheme();
    expect(getStoredAccent()).toBeNull();
  });
});
