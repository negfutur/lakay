# EAS Build Integration Notes

## Verified provider requirements

Expo’s EAS webhook service delivers build and submission events as JSON over HTTP `POST`. Each request is signed in the `expo-signature` header with a hex-encoded HMAC-SHA1 of the raw body. The secret must be at least 16 characters; receivers should verify it before applying status changes. Build payloads include a provider build ID, platform, terminal status (`finished`, `errored`, or `canceled`), a build-details URL, optional artifact download URL, error information, and timestamps. Expo retries webhook delivery with exponential backoff after non-2xx/3xx responses. [1]

EAS CI execution requires an Expo personal access token in `EXPO_TOKEN` and a project that has been configured at least once with the EAS CLI. A no-wait Android build submission is triggered with `eas build --platform android --non-interactive --no-wait`; the service then performs the build asynchronously. CI trigger success is not evidence that the artifact exists, so Lakay must wait for a signed terminal webhook or a verified provider-status response before showing a download action. [2]

## Lakay implications

Lakay must keep Expo credentials server-side, record the provider build ID before accepting status updates, verify the raw webhook signature in constant time, reject mismatched project or platform data, accept safe idempotent repeats, and expose an APK/AAB link only from a provider-confirmed successful artifact. Webhook delivery is the preferred asynchronous reconciliation mechanism; a status query can serve as a deliberate recovery path but must never fabricate a completed build.

## References

[1]: https://docs.expo.dev/eas/webhooks/ "Expo — Webhooks"
[2]: https://docs.expo.dev/build/building-on-ci/ "Expo — Trigger builds from CI"
