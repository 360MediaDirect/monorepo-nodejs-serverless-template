import { getEmbassy, issuer } from '@360mediadirect/auth-helper'

export const embassy = getEmbassy()
export { issuer }
export const magicAudience = `${issuer}/magic`

export const getSigningKeyId = (): string => {
  return process.env.SIGNING_KEY_ID || '20230317'
}
