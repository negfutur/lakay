# EAS Build Webhook Reference

Lakay’s Android build delivery path follows Expo’s documented webhook contract. Expo sends build events as signed HTTP `POST` requests. The `expo-signature` header is an HMAC-SHA1 signature of the raw request body using a shared webhook secret. Successful Android builds may include `artifacts.buildUrl`; Lakay records a delivery link only after it validates that link and the expiration timestamp.

The public endpoint is:

```
https://lakayapp-hiqx5oba.manus.space/api/eas/webhook
```

Opening the address in a browser only returns a safe service description. It cannot report build details or start a build. Only a valid signed `POST` from Expo may update an owner-scoped build job.

The current server-side Expo token was verified through Expo’s read-only identity query for the `zetwal` account. The GitHub workflow bridge was also verified. A shared `EAS_WEBHOOK_SECRET` is configured server-side and its signature was validated with a harmless local probe. The user must still add the endpoint and the same secret to the relevant Expo project’s Build webhook configuration before the first real build can be verified end to end.

## Source

- [Expo: Webhooks](https://docs.expo.dev/eas/webhooks/) — build payload, HMAC-SHA1 signature header, webhook event setup, artifact URL behavior.
- [Expo: Trigger builds from CI](https://docs.expo.dev/build/building-on-ci/) — first-build prerequisites, `EXPO_TOKEN`, and non-interactive CI build dispatch.
