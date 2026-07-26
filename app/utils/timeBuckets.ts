export type ElapsedTimeBuckets = {
  seconds: number;
  minutes: number;
  hours: number;
  days: number;
};

// The records feed (useRecords.ts) and the sources list (useSources.ts) each
// render their own "time since X" wording, but both start from the same
// seconds/minutes/hours/days breakdown — kept here once so the two can't
// drift. Returns null for an unparseable date so callers can't forget to
// guard against it (an omission that predated this shared helper).
export function computeElapsedBuckets(
  pastIsoString: string,
): ElapsedTimeBuckets | null {
  const diffMs = Date.now() - new Date(pastIsoString).getTime();

  if (Number.isNaN(diffMs)) {
    return null;
  }

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  return { seconds, minutes, hours, days };
}
