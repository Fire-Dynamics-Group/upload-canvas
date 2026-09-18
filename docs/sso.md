# Microsoft Entra SSO

Upload Canvas uses the existing FD Email Bot Entra application to sign users in
with its delegated `openid`, `profile`, and `email` permissions. The browser
never needs a client secret.

## Entra setup

Add the exact SPA redirect URIs for the Canvas production host, its stable
development host, and `http://localhost:3000` to the existing application.
The backend accepts the ID token issued to this Entra client. If the registration
later exposes `api://<client-id>/access_as_user`, configure that scope to use
an API access token instead.

## Frontend configuration

The shared FD application identifiers are built in. Override them only when
testing another Entra application:

```dotenv
NEXT_PUBLIC_ENTRA_CLIENT_ID=
NEXT_PUBLIC_ENTRA_TENANT_ID=
# Optional: only set after the Entra app exposes this scope.
NEXT_PUBLIC_ENTRA_API_SCOPE=
NEXT_PUBLIC_API_URL=
```

For local work without an Entra redirect URI, set both values below. Mock mode
only runs on localhost, or on a preview deployment explicitly labelled
`preview`; it cannot activate on production merely because the flag is set.

```dotenv
NEXT_PUBLIC_AUTH_DISABLED=true
NEXT_PUBLIC_DEPLOYMENT_ENV=preview
```

## Backend rollout

Deploy the `sso-backend` changes first with `AUTH_MODE=log`. That records and
checks tokens while preserving existing callers. After a real Canvas login and
project create/load/save check, set `AUTH_MODE=enforce` to require a valid
Entra access token for Canvas APIs.

Existing projects keep their legacy creator label. New projects store the
signed-in user's Entra object ID as `created_by`.
