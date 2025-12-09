import { embassy } from '../lib/authorizer'
import { validateMagicToken } from '@360mediadirect/auth-helper'
import { Verifier } from '../types'

/**
 * Verifies the authenticity of our own provided magic token, by checking it
 * against our own public keys and audience string.
 * @param tokenStr The provided token
 * @returns The useful payload of the token
 */
export const magic: Verifier = async (tokenStr) => {
  // Throws with 401 if invalid
  const token = await validateMagicToken(tokenStr, embassy)
  return {
    userId: token.claims.sub,
    email: token.claims.email as string,
    issuedAt: token.claims.iat * 1000,
    domainScopes: {},
  }
}
