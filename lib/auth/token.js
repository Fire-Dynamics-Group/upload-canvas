let tokenProvider = async () => null

export const setTokenProvider = (provider) => {
  tokenProvider = provider
}

export const getAccessToken = () => tokenProvider()

export const authedFetch = async (input, init = {}) => {
  const token = await getAccessToken()
  const headers = new Headers(init.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  return fetch(input, { ...init, headers })
}
