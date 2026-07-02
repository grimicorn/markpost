// Shared helper for reading the JSON:API-style error detail out of a failed
// $fetch call. Nuxt's $fetch (ofetch) throws a FetchError whose `.data` holds
// the parsed response body, which on this API is always `{ errors: [...] }`
// (see server/utils/errors.ts#apiErrorHandler).
export type ApiFetchError = {
  data?: { errors?: { detail: string }[] };
};

export function extractErrorDetail(error: unknown, fallback: string): string {
  const fetchError = error as ApiFetchError;
  return fetchError?.data?.errors?.[0]?.detail ?? fallback;
}
