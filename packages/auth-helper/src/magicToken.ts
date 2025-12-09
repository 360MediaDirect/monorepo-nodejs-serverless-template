import { getEmbassy, issuer } from './getEmbassy'
import { DEFAULTS } from './constants'

interface CreateMagicTokenOpts {
  embassy?: ReturnType<typeof getEmbassy>
  email: string
  userId: string
  expiresInSecs?: number
}

export const magicAudience = `${issuer}/magic`

export const getSigningKeyId = (): string => {
  return process.env.SIGNING_KEY_ID || '20230317'
}

const MAGIC_EXPIRATION_SECS = process.env.MAGIC_EXPIRATION_SECS
  ? +process.env.MAGIC_EXPIRATION_SECS
  : DEFAULTS.MAGIC_EXPIRATION_SECS

/**
 * Creates a signed magic token string
 * @param opts A mapping of options required to create the token
 * @param opts.email The email address of the user
 * @param opts.userId The user's id
 * @param opts.embassy The embassy to use for token creation. Defaults to a new
 * embassy created by `getEmbassy`
 * @param opts.expiresInSecs The number of seconds for which the token should be
 * valid from the time it's created. Defaults to 1 day.
 * @returns A signed magic token string
 */
export const createMagicToken = async (opts: CreateMagicTokenOpts) => {
  const embassy = opts.embassy || getEmbassy()
  const { email, userId, expiresInSecs = MAGIC_EXPIRATION_SECS } = opts
  const token = embassy.createToken({ sub: userId, email })
  const signed = await token.sign(getSigningKeyId(), {
    audience: magicAudience,
    expiresInSecs,
  })
  return signed
}

/**
 * Validates that a given magic token is legitimate and not expired.
 * @param tokenStr A magic token to be tested for validity
 * @param embassy An existing embassy instance. If not provided, a new embassy
 * instance will be created with `getEmbassy`.
 * @returns An Embassy Token instance, parsed from the tokenStr.
 * @throws Error status=401 if the validation fails
 */
export const validateMagicToken = async (
  tokenStr: string,
  embassy = getEmbassy(),
) => {
  const token = embassy.parseToken(tokenStr)
  await token.verify({ audience: magicAudience })
  return token
}
