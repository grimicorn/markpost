# Record Data Model

## Summary

Define the `Record` entity — the core data structure that the API stores and retrieves.

## Acceptance Criteria

- A record has exactly four fields:
  - `uuid` — a UUID v4 string, generated server-side on creation
  - `createdAt` — an ISO 8601 timestamp string, generated server-side on creation
  - `title` — a non-empty string provided by the client
  - `content` — a non-empty string provided by the client
- Records are immutable after creation (no update operation)
- `uuid` is the primary key used to fetch and delete individual records

## Notes

- Both `uuid` and `createdAt` are always server-generated; clients never supply them
- The `content` field has no length limit or format constraint in the current implementation
