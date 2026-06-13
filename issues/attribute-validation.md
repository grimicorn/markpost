# Attribute Validation

## Summary

Validate that required fields are present in the JSON API request body before processing. Missing fields return a `422` with per-field error objects.

## Acceptance Criteria

- Validate that each required attribute key is present and truthy in `body.data.attributes`
- If one or more required attributes are missing, return `422 Unprocessable Entity` with one error object per missing field:
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
- All missing-field errors are collected and returned together in a single response (not one at a time)
- The default `detail` message is `"<Titleized key> is required"` (e.g. key `title` → `"Title is required"`)
- A custom `detail` message can be supplied per field to override the default

## Notes

- "Truthy" check — a field that is present but empty string or `0` would also fail validation (current behavior matches JS falsy check)
- The `pointer` in `source` follows JSON Pointer format: `/data/attributes/<key>`
- Titleization capitalizes the first letter of each word in the key (e.g. `apiToken` → `Api Token` is how the `titleize` package behaves)
