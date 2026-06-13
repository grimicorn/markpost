# Storage Layer

## Summary

Implement a persistent storage interface for records that supports the operations required by all API endpoints. The current implementation uses Netlify Blobs as a key-value store keyed by `uuid`.

## Acceptance Criteria

- **Write** a single record by its `uuid` key
- **Read** a single record by its `uuid` key; returns `null` (not an error) when the key does not exist
- **List** all record keys; returns an ordered list that supports offset-based slicing for pagination
- **Delete** a record by its `uuid` key; supports deleting multiple records concurrently

## Notes

- Current implementation stores records as JSON blobs keyed by UUID
- `list()` returns all keys at once — pagination is done in application code by slicing the full list, not at the storage level
- A missing key on read returns `null` silently; the calling code handles the null case
- Deletes are fire-and-forget in parallel (`Promise.all`) — no error is raised if a UUID does not exist
- Abstracting this behind an interface will make it straightforward to swap storage backends (the main motivation for the rewrite)
