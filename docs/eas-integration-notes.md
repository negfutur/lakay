# EAS Build Integration Notes

Lakay’s EAS export target is intended for Expo/React Native projects. EAS CLI configures a project with `eas build:configure`; Android preview builds can use an internal-distribution APK profile, while production builds can use an Android App Bundle profile. EAS sends build completion webhooks as HTTP POST JSON payloads signed with the `expo-signature` HMAC-SHA1 header using a per-project webhook secret. A successful build webhook includes `status: "finished"` and an artifact `buildUrl`.

Sources: https://docs.expo.dev/build/setup/ ; https://docs.expo.dev/build/introduction/ ; https://docs.expo.dev/eas/webhooks/
