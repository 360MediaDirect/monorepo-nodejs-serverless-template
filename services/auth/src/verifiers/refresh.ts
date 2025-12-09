import { embassy, issuer } from '../lib/authorizer'
import { Verifier } from '../types'

/**
 * Verifies the authenticity of our own provided refresh token, by checking it
 * against our own public keys and audience string.
 * @param tokenStr The provided token
 * @returns The useful payload of the token
 */
export const refresh: Verifier = async (tokenStr) => {
  const token = embassy.parseToken(tokenStr)
  await token.verify({ audience: issuer }) // Throws with 401 if invalid
  const domainScopes: Record<string, string[]> = {}
  return {
    userId: token.claims.sub,
    email: token.claims.email as string,
    issuedAt: token.claims.iat * 1000,
    domainScopes,
  }
}
