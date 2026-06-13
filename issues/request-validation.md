# Request Validation Middleware

## Summary

Before auth or body parsing runs, validate that the request uses the correct HTTP method and includes the required `Content-Type` header.

## Acceptance Criteria

- If the request method does not match the expected method for the route, return `405 Method Not Allowed`:
  ```json
  {
    "data": {
      "errors": [{ "status": "405", "title": "Method Not Allowed", "detail": "<METHOD> method is not allowed" }]
    }
  }
  ```
  where `<METHOD>` is the actual method sent by the client (e.g. `PATCH`)

- If the request is missing a `Content-Type: application/json` header, return `415 Unsupported Media Type`:
  ```json
  {
    "data": {
      "errors": [{ "status": "415", "title": "Unsupported Media Type", "detail": "Content-Type must be application/json" }]
    }
  }
  ```

- The `Content-Type` check only applies to endpoints that accept a request body (`POST`, `DELETE`). `GET` endpoints skip the content-type check.

## Notes

- Method comparison is case-insensitive
- The `Content-Type` check passes as long as the header value *includes* `application/json` (e.g. `application/json; charset=utf-8` is acceptable)
- This runs before auth — a wrong method or missing content-type is rejected even if the token would have been valid
