import { describe, it, expect, vi, beforeEach } from "vitest";
import { nextTick } from "vue";
import { useSyncSettings } from "../../app/composables/useSyncSettings";

const DEFAULT_SETTINGS = {
  autoSync: true,
  autoDelete: true,
  frontmatter: true,
  conflictStrategy: "suffix",
  vaultDir: "~/Documents/Vault",
  filenameTemplate: "{{date}}-{{slug}}.md",
};

function makeSuccessResponse(overrides = {}) {
  return {
    data: {
      type: "user_settings",
      id: "user_123",
      attributes: { ...DEFAULT_SETTINGS, ...overrides },
    },
  };
}

function makeErrorResponse(detail = "Something went wrong.") {
  return { errors: [{ detail }] };
}

const mockFetch = vi.fn();

vi.stubGlobal("$fetch", mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

describe("useSyncSettings", () => {
  describe("load()", () => {
    it("sets current from the API response on success", async () => {
      mockFetch.mockResolvedValueOnce(
        makeSuccessResponse({ vaultDir: "~/Obsidian" }),
      );

      const { current, load } = useSyncSettings();
      await load();

      expect(current.value.vaultDir).toBe("~/Obsidian");
    });

    it("sets isLoading to true during the request and false after", async () => {
      let capturedDuringLoad = false;
      mockFetch.mockImplementationOnce(async () => {
        capturedDuringLoad = true;
        return makeSuccessResponse();
      });

      const { isLoading, load } = useSyncSettings();
      const promise = load();
      expect(isLoading.value).toBe(true);
      await promise;
      expect(isLoading.value).toBe(false);
      expect(capturedDuringLoad).toBe(true);
    });

    it("sets loadError when the API returns an error body", async () => {
      mockFetch.mockResolvedValueOnce(makeErrorResponse("Not authorised."));

      const { loadError, load } = useSyncSettings();
      await load();

      expect(loadError.value).toBe("Not authorised.");
    });

    it("sets loadError on a network throw", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const { loadError, load } = useSyncSettings();
      await load();

      expect(loadError.value).toBe("Failed to load settings.");
    });

    it("surfaces the detail from a FetchError body on load failure", async () => {
      const fetchError = Object.assign(new Error("Fetch failed"), {
        data: { errors: [{ detail: "Session expired." }] },
      });
      mockFetch.mockRejectedValueOnce(fetchError);

      const { loadError, load } = useSyncSettings();
      await load();

      expect(loadError.value).toBe("Session expired.");
    });

    it("coerces an unexpected conflictStrategy to the default", async () => {
      mockFetch.mockResolvedValueOnce(
        makeSuccessResponse({ conflictStrategy: "unsupported_value" }),
      );

      const { current, load } = useSyncSettings();
      await load();

      expect(current.value.conflictStrategy).toBe("suffix");
    });

    it("does not start a second load while one is in flight", async () => {
      let resolveFirst!: (value: unknown) => void;
      mockFetch.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
      );

      const { load } = useSyncSettings();
      const firstLoad = load();
      const secondLoad = load();
      resolveFirst(makeSuccessResponse());
      await Promise.all([firstLoad, secondLoad]);

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("saves a snapshot of the loaded settings for reset", async () => {
      mockFetch.mockResolvedValueOnce(makeSuccessResponse({ autoSync: false }));

      const { current, load, reset } = useSyncSettings();
      await load();

      current.value.autoSync = true;
      reset();

      expect(current.value.autoSync).toBe(false);
    });

    it("hasSaved is false before load and true after a successful load", async () => {
      mockFetch.mockResolvedValueOnce(makeSuccessResponse());

      const { hasSaved, load } = useSyncSettings();
      expect(hasSaved.value).toBe(false);
      await load();
      expect(hasSaved.value).toBe(true);
    });

    it("hasSaved stays false when load fails", async () => {
      mockFetch.mockResolvedValueOnce(makeErrorResponse("DB unavailable."));

      const { hasSaved, load } = useSyncSettings();
      await load();
      expect(hasSaved.value).toBe(false);
    });
  });

  describe("save()", () => {
    it("sends a PUT to /api/settings with current values", async () => {
      mockFetch
        .mockResolvedValueOnce(makeSuccessResponse())
        .mockResolvedValueOnce(makeSuccessResponse({ vaultDir: "~/NewVault" }));

      const { current, load, save } = useSyncSettings();
      await load();

      current.value.vaultDir = "~/NewVault";
      await save();

      expect(mockFetch).toHaveBeenCalledWith("/api/settings", {
        method: "PUT",
        body: {
          data: {
            type: "user_settings",
            attributes: expect.objectContaining({ vaultDir: "~/NewVault" }),
          },
        },
      });
    });

    it("sets saveSuccess to true on success", async () => {
      mockFetch
        .mockResolvedValueOnce(makeSuccessResponse())
        .mockResolvedValueOnce(makeSuccessResponse());

      const { saveSuccess, load, save } = useSyncSettings();
      await load();
      await save();

      expect(saveSuccess.value).toBe(true);
    });

    it("sets saveError when the API returns an error body", async () => {
      mockFetch
        .mockResolvedValueOnce(makeSuccessResponse())
        .mockResolvedValueOnce(makeErrorResponse("Validation failed."));

      const { saveError, load, save } = useSyncSettings();
      await load();
      await save();

      expect(saveError.value).toBe("Validation failed.");
    });

    it("sets saveError on a network throw", async () => {
      mockFetch
        .mockResolvedValueOnce(makeSuccessResponse())
        .mockRejectedValueOnce(new Error("Network error"));

      const { saveError, load, save } = useSyncSettings();
      await load();
      await save();

      expect(saveError.value).toBe("Failed to save settings.");
    });

    it("surfaces the detail from a FetchError body on save failure", async () => {
      const fetchError = Object.assign(new Error("Fetch failed"), {
        data: { errors: [{ detail: "Conflict: stale data." }] },
      });
      mockFetch
        .mockResolvedValueOnce(makeSuccessResponse())
        .mockRejectedValueOnce(fetchError);

      const { saveError, load, save } = useSyncSettings();
      await load();
      await save();

      expect(saveError.value).toBe("Conflict: stale data.");
    });

    it("sets isSaving to true during the request and false after", async () => {
      let capturedDuringSave = false;
      mockFetch
        .mockResolvedValueOnce(makeSuccessResponse())
        .mockImplementationOnce(async () => {
          capturedDuringSave = true;
          return makeSuccessResponse();
        });

      const { isSaving, load, save } = useSyncSettings();
      await load();
      const promise = save();
      expect(isSaving.value).toBe(true);
      await promise;
      expect(isSaving.value).toBe(false);
      expect(capturedDuringSave).toBe(true);
    });

    it("updates saved snapshot on success so reset returns new values", async () => {
      mockFetch
        .mockResolvedValueOnce(makeSuccessResponse({ vaultDir: "~/Old" }))
        .mockResolvedValueOnce(makeSuccessResponse({ vaultDir: "~/New" }));

      const { current, load, save, reset } = useSyncSettings();
      await load();
      current.value.vaultDir = "~/New";
      await save();

      current.value.vaultDir = "~/Temporary";
      reset();

      expect(current.value.vaultDir).toBe("~/New");
    });

    it("clears saveSuccess and saveError when current changes after a save", async () => {
      mockFetch
        .mockResolvedValueOnce(makeSuccessResponse())
        .mockResolvedValueOnce(makeSuccessResponse());

      const { current, saveSuccess, saveError, load, save } = useSyncSettings();
      await load();
      await save();
      expect(saveSuccess.value).toBe(true);

      current.value.vaultDir = "~/Changed";
      await nextTick();

      expect(saveSuccess.value).toBe(false);
      expect(saveError.value).toBeNull();
    });
  });

  describe("reset()", () => {
    it("restores current to last saved values", async () => {
      mockFetch.mockResolvedValueOnce(
        makeSuccessResponse({ conflictStrategy: "skip" }),
      );

      const { current, load, reset } = useSyncSettings();
      await load();

      current.value.conflictStrategy = "overwrite";
      reset();

      expect(current.value.conflictStrategy).toBe("skip");
    });

    it("clears saveError and saveSuccess on reset", async () => {
      mockFetch
        .mockResolvedValueOnce(makeSuccessResponse())
        .mockResolvedValueOnce(makeErrorResponse("Nope."));

      const { saveError, saveSuccess, load, save, reset } = useSyncSettings();
      await load();
      await save();

      expect(saveError.value).toBe("Nope.");
      reset();

      expect(saveError.value).toBeNull();
      expect(saveSuccess.value).toBe(false);
    });

    it("does nothing if settings have never been loaded", () => {
      const { current, reset } = useSyncSettings();
      const before = { ...current.value };
      reset();
      expect(current.value).toEqual(before);
    });
  });
});
