# EAS Build Webhook Reference

Lakay’s Android build delivery path follows Expo’s documented webhook contract. Expo sends build events as signed HTTP `POST` requests. The `expo-signature` header is an HMAC-SHA1 signature of the raw request body using a shared webhook secret. Successful Android builds may include `artifacts.buildUrl`; Lakay records a delivery link only after it validates that link and the expiration timestamp.

The public endpoint is:

```
https://lakayapp-hiqx5oba.manus.space/api/eas/webhook
```

Opening the address in a browser only returns a safe service description. It cannot report build details or start a build. Only a valid signed `POST` from Expo may update an owner-scoped build job.

The current server-side Expo token was verified through Expo’s read-only identity query for the `zetwal` account. The GitHub workflow bridge was also verified. A shared `EAS_WEBHOOK_SECRET` is configured server-side and its signature was validated with a harmless local probe. The user must still add the endpoint and the same secret to the relevant Expo project’s Build webhook configuration before the first real build can be verified end to end.

## First Expo project

Expo’s CI guidance states that a project should first be configured successfully for EAS Build so that its EAS project identity, build profiles, Android package metadata, and credentials are available to non-interactive builds. Lakay’s generated mobile package already supplies the owner, app name, slug, Android package, and `eas.json` profiles. The GitHub workflow must run `eas init --non-interactive` before the build command so EAS can create or link the project from that generated package. The project will therefore not appear in the Expo dashboard until this initialization step has run successfully.

The documented build command remains `eas build --platform android --profile <profile> --non-interactive --no-wait`. This request starts a provider-side build and may incur Expo usage; Lakay must require an explicit user confirmation before dispatching it.

## Source

- [Expo: Webhooks](https://docs.expo.dev/eas/webhooks/) — build payload, HMAC-SHA1 signature header, webhook event setup, artifact URL behavior.
- [Expo: Trigger builds from CI](https://docs.expo.dev/build/building-on-ci/) — first-build prerequisites, `EXPO_TOKEN`, and non-interactive CI build dispatch.
- [Expo: EAS CLI reference](https://docs.expo.dev/eas/cli/) — current `eas build`, `eas build:configure`, and non-interactive command contracts.
