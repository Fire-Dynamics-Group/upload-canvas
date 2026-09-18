export const entraConfig = {
  clientId: process.env.NEXT_PUBLIC_ENTRA_CLIENT_ID || '2b180b8a-7cd3-40b2-83dd-8338103ce41e',
  tenantId: process.env.NEXT_PUBLIC_ENTRA_TENANT_ID || '8c535dde-8170-4909-8edc-40bbff4924ba',
}

export const authority = `https://login.microsoftonline.com/${entraConfig.tenantId}`
// Mail Marshal's existing registration is configured for OpenID Connect. A
// custom API scope can be supplied later, once it has been exposed in Entra.
export const apiScope = process.env.NEXT_PUBLIC_ENTRA_API_SCOPE || null
export const identityScopes = ['openid', 'profile', 'email']
