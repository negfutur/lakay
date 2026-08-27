# OpenRouter integration notes

Official OpenRouter documentation confirms that the server API uses Bearer authentication at `https://openrouter.ai/api/v1`. The authenticated model list is available through `GET /models`; chat completions use `POST /chat/completions` in the OpenAI-compatible format. The documented retryable failure classes include rate limits (`429`), temporary availability (`503`), upstream failure (`502`), overload (`529`), and timeout responses (`408`, `524`).

Lakay must keep the OpenRouter key in server-only environment configuration, never in generated projects or client code. The implementation should use a bounded timeout/retry policy and only fall back after retryable provider failures. It must not retry authentication, malformed-request, or payment/quota failures across providers without an explicit route policy.

Sources: https://openrouter.ai/docs/api_reference/authentication ; https://openrouter.ai/docs/api/api-reference/models/list-all-models-and-their-properties ; https://openrouter.ai/docs/api/api-reference/chat/create-a-chat-completion
