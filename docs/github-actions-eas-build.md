# GitHub Actions and EAS Build setup

The repository contains a **manual Android EAS workflow** at `.github/workflows/eas-build.yml`. It accepts only the mobile-source directory and build profile as inputs. Expo access remains in the repository secret `EXPO_TOKEN`; it is not committed, shown in Lakay, or sent as a workflow input.

Before the first use, open the repository’s **Settings → Secrets and variables → Actions** page and create an `EXPO_TOKEN` repository secret using the Expo access token already validated for the Lakay backend. Do not place the token in a source file or in the workflow form.

Expo requires the mobile app to have been configured for non-interactive EAS builds before CI can trigger it. Run the initial EAS setup/build once against the generated Expo source so EAS can create the project identifier and Android credentials. Thereafter, dispatch **EAS Android Build** from the Actions tab, choose `preview` for an installable APK or `production` for an AAB.

The workflow intentionally has no `push` trigger, so no Android build starts unexpectedly from an ordinary code update. A future Lakay dispatch bridge must upload the project-scoped generated Expo source and correlate the EAS webhook result with the correct protected build request before the application can show a verified download link.
