# Provider Availability Verification

## Gemini Pro

On 2026-08-28, a minimal request to `gemini-3.1-pro-preview` reached Gemini successfully but returned HTTP 429 before generation. The provider reported a free-tier request and token limit of zero for that model on the configured account. Lakay routes premium planning and initial work to this explicit model, but it cannot complete until the Gemini account has available quota.

## OpenRouter free fallback

On 2026-08-28, the configured OpenRouter account listed `google/gemma-4-31b-it:free`, `z-ai/glm-5.2:free`, and `minimax/minimax-m3:free`. Minimal live requests found Gemma 4 31B and GLM 5.2 temporarily rate-limited by their shared upstream pools. MiniMax M3 completed successfully with a reported cost of zero. Lakay prioritizes Gemma, then GLM, then MiniMax and now skips an immediately rate-limited shared free route instead of retrying it.

## Source references

- https://ai.google.dev/gemini-api/docs/changelog
- https://ai.google.dev/gemini-api/docs/gemini-3
- https://openrouter.ai/api/v1/models
