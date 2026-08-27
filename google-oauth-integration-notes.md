# Google OAuth integration notes

Google’s web-server authorization-code flow requires a registered OAuth Web client, an exact authorized redirect URI, a random state value, and server-side exchange of the returned authorization code. Lakay requests only the `openid`, `email`, and `profile` scopes for sign-in, verifies the Google ID token signature, issuer, audience, subject, and verified e-mail before account lookup, and never puts the client secret in the browser or source repository.

Google requires the authorization endpoint to be HTTPS and matches the redirect URI exactly. Lakay’s production redirect URI is `https://lakayapp-hiqx5oba.manus.space/api/auth/google/callback`.

Source: https://developers.google.com/identity/protocols/oauth2/web-server
