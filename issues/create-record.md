# Create Record — POST /api/records

## Summary

Create a new record with a title and content. The server generates the UUID and timestamp.

## Acceptance Criteria

- **Route:** `POST /api/records`
- **Auth:** required (Bearer token)
- **Content-Type header:** `application/json` required

### Request body

```json
{
  "data": {
    "attributes": {
      "title": "My title",
      "content": "My content"
    }
  }
}
```

Both `title` and `content` are required. Missing either returns `422` (see [attribute-validation.md](attribute-validation.md)).

### Successful response — `201 Created`

```json
{
  "data": {
    "type": "records",
    "id": "<generated-uuid>",
    "attributes": {
      "uuid": "<generated-uuid>",
      "createdAt": "<iso8601-timestamp>",
      "title": "My title",
      "content": "My content"
    },
    "links": {
      "self": "/api/records/<generated-uuid>"
    }
  }
}
```

- `uuid` is a server-generated UUID v4
- `createdAt` is a server-generated ISO 8601 timestamp (`new Date().toISOString()`)
- The created record is persisted before the response is returned

## Notes

- There is no uniqueness check on `title` — duplicate titles are allowed
- No maximum length is enforced on `title` or `content`
