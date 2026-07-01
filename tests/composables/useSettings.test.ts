import { describe, it, expect, vi, beforeEach } from "vitest";

const fetchMock = vi.fn();
vi.stubGlobal("$fetch", fetchMock);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useSettings — fetchSettings", () => {
  it("calls GET /api/settings and populates theme and accentColor", async () => {
    fetchMock.mockResolvedValueOnce({
      data: {
        attributes: { theme: "dark", accentColor: "#6366f1" },
      },
    });

    const { useSettings } = await import("../../app/composables/useSettings");
    const { theme, accentColor, fetchSettings } = useSettings();

    await fetchSettings();

    expect(fetchMock).toHaveBeenCalledWith("/api/settings");
    expect(theme.value).toBe("dark");
    expect(accentColor.value).toBe("#6366f1");
  });

  it("rejects when the fetch fails", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network error"));
    const { useSettings } = await import("../../app/composables/useSettings");
    const { fetchSettings } = useSettings();

    await expect(fetchSettings()).rejects.toThrow("network error");
  });

  it("leaves refs null when response has no attributes", async () => {
    fetchMock.mockResolvedValueOnce({ data: {} });
    const { useSettings } = await import("../../app/composables/useSettings");
    const { theme, accentColor, fetchSettings } = useSettings();

    await fetchSettings();

    expect(theme.value).toBeNull();
    expect(accentColor.value).toBeNull();
  });
});

describe("useSettings — updateAppearance", () => {
  it("calls PUT /api/settings with theme and accentColor wrapped in JSON:API shape", async () => {
    fetchMock.mockResolvedValueOnce({});
    const { useSettings } = await import("../../app/composables/useSettings");
    const { updateAppearance } = useSettings();

    await updateAppearance({ theme: "dark", accentColor: "#0e9f6e" });

    expect(fetchMock).toHaveBeenCalledWith("/api/settings", {
      method: "PUT",
      body: {
        data: {
          type: "user_settings",
          attributes: { theme: "dark", accentColor: "#0e9f6e" },
        },
      },
    });
  });

  it("calls PUT with only accentColor when only accent changes", async () => {
    fetchMock.mockResolvedValueOnce({});
    const { useSettings } = await import("../../app/composables/useSettings");
    const { updateAppearance } = useSettings();

    await updateAppearance({ accentColor: "#ea580c" });

    expect(fetchMock).toHaveBeenCalledWith("/api/settings", {
      method: "PUT",
      body: {
        data: {
          type: "user_settings",
          attributes: { accentColor: "#ea580c" },
        },
      },
    });
  });

  it("propagates errors from a failed PUT", async () => {
    fetchMock.mockRejectedValueOnce(new Error("server error"));
    const { useSettings } = await import("../../app/composables/useSettings");
    const { updateAppearance } = useSettings();

    await expect(updateAppearance({ theme: "light" })).rejects.toThrow(
      "server error",
    );
  });
});
