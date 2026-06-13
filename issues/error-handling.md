# Error Handling

## Summary

All API errors follow a consistent JSON API error envelope. Implement a typed error class and a top-level error handler that converts both expected and unexpected errors into proper responses.

## Acceptance Criteria

### Error response envelope

```json
{
  "data": {
    "errors": [
      {
        "status": "422",
        "title": "Invalid Attribute",
        "detail": "Title is required",
        "source": { "pointer": "/data/attributes/title" }
      }
    ]
  }
}
```

- `status` is always a string (not a number)
- `source` is optional; it is present for validation errors (using `pointer`) and path parameter errors (using `parameter`)
- Multiple errors can appear in a single response (e.g. two missing attributes)

### Error types and status codes

| Scenario | HTTP status | Title |
|---|---|---|
| Wrong HTTP method | 405 | Method Not Allowed |
| Missing `Content-Type: application/json` | 415 | Unsupported Media Type |
| Missing/invalid auth token | 401 | Unauthorized |
| Missing required attribute in body | 422 | Invalid Attribute |
| Missing required path parameter | 400 | Bad Request |
| Unhandled exception | 500 | Internal Server Error |

### Unhandled exceptions

- Log the full error to stderr/console
- Return a generic `500` response with `detail: "Unknown error occurred."`
- Do not leak stack traces or internal error messages to the client

## Notes

- The error handler must distinguish between expected API errors (thrown intentionally) and truly unexpected exceptions — only the latter are logged and genericized
