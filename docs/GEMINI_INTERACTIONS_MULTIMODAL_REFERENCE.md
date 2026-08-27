# Gemini Interactions: multimodal background input reference

Lakay’s durable Builder request uses Gemini’s Interactions API with `background: true` and `store: true`.

The official API reference documents `input` as a content value or an array of content values. An image block uses the form:

```json
{
  "type": "image",
  "data": "BASE64_ENCODED_IMAGE",
  "mime_type": "image/png"
}
```

The input image must come from a validated, owner- and project-scoped server-side storage record. Lakay stores only the storage key and MIME type in a durable task row; it reloads and revalidates the bytes immediately before creating the Gemini interaction. Browser file objects and storage keys are never returned to the client for retry.

For a legacy failed first-build task created before per-task visual metadata existed, Lakay can safely use the already validated project-level initial visual reference only when there are no generated files. This preserves the original request without incorrectly attaching an old image to a later incremental modification.

## Source

- [Gemini Interactions API reference — ImageContent](https://ai.google.dev/api/interactions-api)
- [Gemini Interactions API overview](https://ai.google.dev/gemini-api/docs/interactions-overview)
