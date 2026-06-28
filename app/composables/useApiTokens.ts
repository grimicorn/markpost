export type ApiToken = {
  id: string;
  name: string;
  prefix: string;
  createdAt: Date | null;
  lastUsedAt: Date | null;
};

// Wire-level types use string for date fields because JSON serializes Date as ISO string.
type TokenResource = {
  type: "api_tokens";
  id: string;
  attributes: {
    name: string;
    prefix: string;
    createdAt: string | null;
    lastUsedAt: string | null;
  };
};

type TokenListResponse = {
  data?: TokenResource[];
  errors?: { detail: string }[];
};

type MintedTokenResource = {
  type: "api_tokens";
  id: string;
  attributes: {
    name: string;
    prefix: string;
    createdAt: string | null;
    token: string;
  };
};

type MintTokenResponse = {
  data?: MintedTokenResource;
  errors?: { detail: string }[];
};

type RevokeTokenResponse = {
  data?: null;
  errors?: { detail: string }[];
};

type FetchError = {
  data?: { errors?: { detail: string }[] };
};

const API_TOKENS_ENDPOINT = "/api/tokens";

function isErrorBody(
  response: TokenListResponse | MintTokenResponse | RevokeTokenResponse,
): boolean {
  return (
    "errors" in response &&
    Array.isArray(response.errors) &&
    response.errors.length > 0
  );
}

function extractErrorDetail(error: unknown, fallback: string): string {
  const fetchError = error as FetchError;
  return fetchError?.data?.errors?.[0]?.detail ?? fallback;
}

function bodyErrorDetail(
  errors: { detail: string }[] | undefined,
  fallback: string,
): string {
  return errors?.[0]?.detail ?? fallback;
}

function deserializeToken(resource: TokenResource): ApiToken {
  return {
    id: resource.id,
    name: resource.attributes.name,
    prefix: resource.attributes.prefix,
    createdAt: resource.attributes.createdAt
      ? new Date(resource.attributes.createdAt)
      : null,
    lastUsedAt: resource.attributes.lastUsedAt
      ? new Date(resource.attributes.lastUsedAt)
      : null,
  };
}

function buildMintBody(name: string) {
  return {
    data: {
      type: "api_tokens",
      attributes: { name },
    },
  };
}

export function useApiTokens() {
  const tokens = ref<ApiToken[]>([]);
  const isLoading = ref(false);
  const loadError = ref<string | null>(null);
  const isMinting = ref(false);
  const mintError = ref<string | null>(null);
  const isRevoking = ref(false);
  const revokeError = ref<string | null>(null);
  const revealedToken = ref("");

  // Internal: fetches and applies the token list without the de-dupe guard.
  // Use this from mintToken so the post-mint refresh always runs.
  async function fetchAndApplyTokens() {
    isLoading.value = true;
    loadError.value = null;

    try {
      const response = await $fetch<TokenListResponse>(API_TOKENS_ENDPOINT);

      if (isErrorBody(response)) {
        loadError.value = bodyErrorDetail(
          response.errors,
          "Failed to load tokens.",
        );
        return;
      }

      tokens.value = (response.data ?? []).map(deserializeToken);
    } catch (error) {
      console.error("[useApiTokens] fetchAndApplyTokens failed:", error);
      loadError.value = extractErrorDetail(error, "Failed to load tokens.");
    } finally {
      isLoading.value = false;
    }
  }

  async function loadTokens() {
    if (isLoading.value) {
      return;
    }

    await fetchAndApplyTokens();
  }

  async function mintToken(name: string) {
    if (isMinting.value) {
      return;
    }

    isMinting.value = true;
    mintError.value = null;
    revealedToken.value = "";

    try {
      const response = await $fetch<MintTokenResponse>(API_TOKENS_ENDPOINT, {
        method: "POST",
        body: buildMintBody(name),
      });

      if (isErrorBody(response)) {
        mintError.value = bodyErrorDetail(
          response.errors,
          "Failed to generate token.",
        );
        return;
      }

      if (!response.data) {
        mintError.value = "Failed to generate token.";
        return;
      }

      revealedToken.value = response.data.attributes.token;
      // Bypass the isLoading guard so the refresh always runs even when the
      // initial load is still in flight.
      await fetchAndApplyTokens();
    } catch (error) {
      console.error("[useApiTokens] mintToken failed:", error);
      mintError.value = extractErrorDetail(error, "Failed to generate token.");
    } finally {
      isMinting.value = false;
    }
  }

  async function revokeToken(tokenId: string) {
    if (isRevoking.value) {
      return;
    }

    isRevoking.value = true;
    revokeError.value = null;

    try {
      const response = await $fetch<RevokeTokenResponse>(
        `${API_TOKENS_ENDPOINT}/${tokenId}`,
        { method: "DELETE" },
      );

      if (isErrorBody(response)) {
        revokeError.value = bodyErrorDetail(
          response.errors,
          "Failed to revoke token.",
        );
        return;
      }

      tokens.value = tokens.value.filter((token) => token.id !== tokenId);
    } catch (error) {
      console.error("[useApiTokens] revokeToken failed:", error);
      revokeError.value = extractErrorDetail(error, "Failed to revoke token.");
    } finally {
      isRevoking.value = false;
    }
  }

  function clearRevealedToken() {
    revealedToken.value = "";
  }

  return {
    tokens,
    isLoading,
    loadError,
    isMinting,
    mintError,
    isRevoking,
    revokeError,
    revealedToken,
    loadTokens,
    mintToken,
    revokeToken,
    clearRevealedToken,
  };
}
