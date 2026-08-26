# External Activation Boundaries

Lakay’s code paths for the protected GitHub/EAS mobile handoff, status tracking, signed callback handling, and verified APK/AAB delivery are implemented. A real Android artifact still requires an administrator to initiate one build in the connected Expo/GitHub environment and to receive a completed callback. Lakay must not claim an APK is available before that provider-side confirmation.

Stripe Checkout remains intentionally inactive. Activation requires the owner to supply approved package labels, credit amounts, currency decisions, real Stripe `price_…` identifiers, and a verified webhook configuration. Draft packages in the Lakay administration center do not expose a customer purchase flow.

The full-stack runner contract is ready for an external isolated executor, but Lakay’s control-plane server never runs generated user applications. Connecting a separate runner or persistent environment is a deployment decision and remains outside the application until such an executor is explicitly provisioned.

Passwordless sign-in and Google sign-in remain external-provider work. Magic links require an e-mail delivery provider, sending domain, and secure delivery credential. Google sign-in requires an OAuth client and consent configuration. Lakay retains local e-mail/password and Manus sign-in until those providers are configured.
