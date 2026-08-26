# EAS Build Integration Boundary

Expo’s supported automation path is to run `eas build --platform android --non-interactive --no-wait` in a CI environment that holds `EXPO_TOKEN`. The current Lakay GitHub Actions bridge follows this pattern: it uploads the generated Expo source to an isolated branch and dispatches the CI workflow. The protected `EAS_BUILD_TOKEN` may be verified server-side for account readiness, but this research found no public, stable direct GraphQL build-submission contract that Lakay should invent or depend on.

EAS build completion should be handled by a per-project webhook. The webhook must use a secret of at least 16 characters and verify the `expo-signature` HMAC-SHA1 against the raw request body before exposing any artifact. Lakay already preserves this delivery rule and only offers an APK/AAB when the callback contains a valid unexpired HTTPS build URL.

The remaining activation step is external: the Expo project must have completed EAS initialization, including a project ID, build profiles, native identifiers, credentials, and a configured webhook. A real build must be triggered and confirmed before a downloadable artifact can be represented as available.

## Official sources

- https://docs.expo.dev/build/building-on-ci/
- https://docs.expo.dev/eas/webhooks/
- https://docs.expo.dev/build/introduction/
