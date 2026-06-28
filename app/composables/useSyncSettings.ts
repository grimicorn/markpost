export type ConflictStrategy = "suffix" | "overwrite" | "skip";

export type SyncSettings = {
  autoSync: boolean;
  autoDelete: boolean;
  frontmatter: boolean;
  conflictStrategy: ConflictStrategy;
  vaultDir: string;
  filenameTemplate: string;
};

type ApiAttributes = {
  autoSync: boolean;
  autoDelete: boolean;
  frontmatter: boolean;
  conflictStrategy: string;
  vaultDir: string;
  filenameTemplate: string;
};

type ApiResourceObject = {
  attributes: ApiAttributes;
};

type ApiSuccessResponse = {
  data: ApiResourceObject;
};

type ApiErrorBody = {
  errors: { detail: string }[];
};

type ApiResponse = ApiSuccessResponse | ApiErrorBody;

type FetchError = {
  data?: ApiErrorBody;
};

const USER_SETTINGS_RESOURCE_TYPE = "user_settings";

const ALLOWED_CONFLICT_STRATEGIES: ConflictStrategy[] = [
  "suffix",
  "overwrite",
  "skip",
];

function isErrorBody(response: ApiResponse): response is ApiErrorBody {
  return "errors" in response && Array.isArray(response.errors);
}

function extractErrorDetail(error: unknown, fallback: string): string {
  const fetchError = error as FetchError;
  return fetchError?.data?.errors?.[0]?.detail ?? fallback;
}

function coerceConflictStrategy(value: string): ConflictStrategy {
  if (ALLOWED_CONFLICT_STRATEGIES.includes(value as ConflictStrategy)) {
    return value as ConflictStrategy;
  }
  return DEFAULT_CONFLICT_STRATEGY;
}

const DEFAULT_CONFLICT_STRATEGY: ConflictStrategy = "suffix";

function extractSyncSettings(attributes: ApiAttributes): SyncSettings {
  return {
    autoSync: attributes.autoSync,
    autoDelete: attributes.autoDelete,
    frontmatter: attributes.frontmatter,
    conflictStrategy: coerceConflictStrategy(attributes.conflictStrategy),
    vaultDir: attributes.vaultDir,
    filenameTemplate: attributes.filenameTemplate,
  };
}

function buildPutBody(settings: SyncSettings) {
  return {
    data: {
      type: USER_SETTINGS_RESOURCE_TYPE,
      attributes: { ...settings },
    },
  };
}

const DEFAULT_SYNC_SETTINGS: SyncSettings = {
  autoSync: true,
  autoDelete: true,
  frontmatter: true,
  conflictStrategy: DEFAULT_CONFLICT_STRATEGY,
  vaultDir: "~/Documents/Vault",
  filenameTemplate: "{{date}}-{{slug}}.md",
};

export function useSyncSettings() {
  const isLoading = ref(false);
  const isSaving = ref(false);
  const loadError = ref<string | null>(null);
  const saveError = ref<string | null>(null);
  const saveSuccess = ref(false);

  const saved = ref<SyncSettings | null>(null);
  const hasSaved = computed(() => saved.value !== null);

  const current = ref<SyncSettings>({ ...DEFAULT_SYNC_SETTINGS });

  let applyingServerResponse = false;

  // flush: "sync" is required here so the guard flag is still set
  // when the watcher fires (the flag resets synchronously after assignment).
  watch(
    current,
    () => {
      if (applyingServerResponse) {
        return;
      }
      saveError.value = null;
      saveSuccess.value = false;
    },
    { deep: true, flush: "sync" },
  );

  function applySettings(settings: SyncSettings) {
    applyingServerResponse = true;
    current.value = { ...settings };
    applyingServerResponse = false;
  }

  async function load() {
    if (isLoading.value) {
      return;
    }

    isLoading.value = true;
    loadError.value = null;

    try {
      const response = await $fetch<ApiResponse>("/api/settings");

      // $fetch throws on non-2xx, but guard against any 2xx error body shape
      if (isErrorBody(response)) {
        loadError.value =
          response.errors[0]?.detail ?? "Failed to load settings.";
        return;
      }

      const settings = extractSyncSettings(response.data.attributes);
      saved.value = { ...settings };
      applySettings(settings);
    } catch (error) {
      console.error("[useSyncSettings] load failed:", error);
      loadError.value = extractErrorDetail(error, "Failed to load settings.");
    } finally {
      isLoading.value = false;
    }
  }

  async function save() {
    if (isSaving.value) {
      return;
    }

    isSaving.value = true;
    saveError.value = null;
    saveSuccess.value = false;

    try {
      const response = await $fetch<ApiResponse>("/api/settings", {
        method: "PUT",
        body: buildPutBody(current.value),
      });

      // $fetch throws on non-2xx, but guard against any 2xx error body shape
      if (isErrorBody(response)) {
        saveError.value =
          response.errors[0]?.detail ?? "Failed to save settings.";
        return;
      }

      const settings = extractSyncSettings(response.data.attributes);
      saved.value = { ...settings };
      applySettings(settings);
      saveSuccess.value = true;
    } catch (error) {
      console.error("[useSyncSettings] save failed:", error);
      saveError.value = extractErrorDetail(error, "Failed to save settings.");
    } finally {
      isSaving.value = false;
    }
  }

  function reset() {
    if (!saved.value) {
      return;
    }
    applySettings(saved.value);
    saveError.value = null;
    saveSuccess.value = false;
  }

  return {
    current,
    hasSaved,
    isLoading,
    isSaving,
    loadError,
    saveError,
    saveSuccess,
    load,
    save,
    reset,
  };
}
