# Get Single Record — GET /api/records/:uuid

## Summary

Return a single record by its UUID. Returns `null` in the data field if the record does not exist (no 404).

## Acceptance Criteria

- **Route:** `GET /api/records/:uuid`
- **Auth:** required (Bearer token)
- **Content-Type header:** not required

### Successful response — `200 OK`

Record found:
```json
{
  "data": {
    "type": "records",
    "id": "<uuid>",
    "attributes": { "uuid": "...", "createdAt": "...", "title": "...", "content": "..." },
    "links": { "self": "/api/records/<uuid>" }
  }
}
```

Record not found:
```json
{
  "data": null
}
```
Status is still `200` — not a 404.

### Missing path parameter — `400 Bad Request`

If `:uuid` is missing or is the literal string `:uuid`:
```json
{
  "data": {
    "errors": [
      {
        "status": "400",
        "title": "Bad Request",
        "detail": "Missing required path parameter: uuid",
        "source": { "parameter": "uuid" }
      }
    ]
  }
}
```

## Notes

- The current implementation catches storage read errors for missing keys and returns `null` silently — the "not found" path must not bubble up as a 500
- The literal `:uuid` guard is a Netlify-specific quirk where unmatched path params are passed through as the raw template string; this may not be necessary in other frameworks
