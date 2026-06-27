const WEBHOOK_INGEST_BASE = "https://ingest.markpost.io/v1/hooks";
const EMAIL_DOMAIN = "in.markpost.io";

export type SourceAttributes = {
  uuid: string;
  userId: string;
  createdAt: string;
  type: string;
  name: string;
  provider: string | null;
  endpointSlug: string;
  routeFolder: string;
  fieldMapping: unknown;
  lastHitAt: string | null;
  recordCount: number;
};

export type SourceResource = {
  type: "sources";
  id: string;
  attributes: SourceAttributes;
  links: { self: string };
};

type SourceListResponse = {
  data: SourceResource[];
};

type SourceResponse = {
  data: SourceResource | null;
};

export type CreateSourcePayload = {
  type: string;
  name: string;
  routeFolder: string;
  provider?: string;
  fieldMapping?: unknown;
};

export function buildEndpointUrl(
  sourceType: string,
  endpointSlug: string,
): string {
  if (sourceType === "email") {
    return `${endpointSlug}@${EMAIL_DOMAIN}`;
  }

  return `${WEBHOOK_INGEST_BASE}/${endpointSlug}`;
}

export function formatLastHit(lastHitAt: string | null): string {
  if (!lastHitAt) {
    return "never hit";
  }

  const diffMs = Date.now() - new Date(lastHitAt).getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) {
    return "last hit just now";
  }

  if (diffMinutes < 60) {
    return `last hit ${diffMinutes}m ago`;
  }

  if (diffHours < 24) {
    return `last hit ${diffHours}h ago`;
  }

  return `last hit ${diffDays}d ago`;
}

export function buildSourceMeta(attributes: SourceAttributes): string[] {
  const recordLabel =
    attributes.recordCount === 1
      ? "1 record"
      : `${attributes.recordCount} records`;

  return [
    recordLabel,
    formatLastHit(attributes.lastHitAt),
    `routes to ${attributes.routeFolder}`,
  ];
}

async function fetchSources(): Promise<SourceResource[]> {
  const response = await $fetch<SourceListResponse>("/api/sources");
  return response.data ?? [];
}

async function createSource(
  payload: CreateSourcePayload,
): Promise<SourceResource> {
  const response = await $fetch<SourceResponse>("/api/sources", {
    method: "POST",
    body: {
      data: {
        type: "sources",
        attributes: payload,
      },
    },
  });

  if (!response.data) {
    throw new Error("Server returned no data for the created source");
  }

  return response.data;
}

async function deleteSource(uuid: string): Promise<void> {
  await $fetch(`/api/sources/${uuid}`, { method: "DELETE" });
}

export function useSources() {
  const sources = ref<SourceResource[]>([]);
  const isLoading = ref(false);

  async function loadSources(): Promise<void> {
    isLoading.value = true;

    try {
      sources.value = await fetchSources();
    } finally {
      isLoading.value = false;
    }
  }

  async function addSource(
    payload: CreateSourcePayload,
  ): Promise<SourceResource> {
    const created = await createSource(payload);
    sources.value = [...sources.value, created];
    return created;
  }

  async function removeSource(uuid: string): Promise<void> {
    await deleteSource(uuid);
    sources.value = sources.value.filter(
      (source) => source.attributes.uuid !== uuid,
    );
  }

  return {
    sources,
    isLoading,
    loadSources,
    addSource,
    removeSource,
  };
}
