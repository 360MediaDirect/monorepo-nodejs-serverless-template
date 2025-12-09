/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { Embassy, PrivateKeyDefinition } from 'embassy'
import SSM from 'aws-sdk/clients/ssm'
import domainScopes from './domainScopes.json'
import {
  DEFAULTS,
  ENVIRONMENTS,
  JWT_ALGORITHM,
  SSM_CONFIG,
  PARAMETER_PATHS,
  AUDIENCE_CONFIG,
} from './constants'

const TOKEN_EXPIRATION_SECS = process.env.TOKEN_EXPIRATION_SECS
  ? +process.env.TOKEN_EXPIRATION_SECS
  : DEFAULTS.TOKEN_EXPIRATION_SECS

const STAGE = process.env.STAGE || DEFAULTS.STAGE

const ssmOpts = {
  apiVersion: SSM_CONFIG.API_VERSION,
  region: process.env.REGION || SSM_CONFIG.DEFAULT_REGION,
}

/**
 * The default token audience. This declares for which platform the tokens are
 * meant to provide authorization. If a service tries to verify the validity of
 * a token using a different audience string, verification will fail.
 *
 * Comes from the env var TOKEN_AUDIENCE, but defaults in the event that it's
 * missing.
 */
export const audience =
  process.env.TOKEN_AUDIENCE ||
  ([ENVIRONMENTS.PRODUCTION, ENVIRONMENTS.PRODUCTION_ALT].includes(STAGE as any)
    ? `${AUDIENCE_CONFIG.AUDIENCE_PREFIX}${AUDIENCE_CONFIG.AUDIENCE_SUFFIX}`
    : `${AUDIENCE_CONFIG.AUDIENCE_PREFIX}-${STAGE}${AUDIENCE_CONFIG.AUDIENCE_SUFFIX}`)

/**
 * The external token issuer. This declares which entity issued the token.
 * Services that verify the validity of the token will look only for the issuer
 * they expect to see, and token verification will fail if the issuer does not
 * match.
 */
export const issuer = `${audience}/auth`

/**
 *  The Embassy class... just in case anyone needs it.
 */
export * from 'embassy'

/**
 * Inspects an error that occurred during key retrieval and returns it again.
 * However, if the error was due to the key not being found, the returned
 * error will be appropriately rewritten, and its `name` property will be set
 * to `KeyNotFound`.
 * @param e An error encountered during key retrieval
 * @param kid The key ID we failed to retrieve
 * @returns An error suitable for throwing
 */
const getThrowableError = (e: Error, kid: string): Error => {
  if (e.name === 'ParameterNotFound') {
    const err = new Error(`Key "${kid}" was not found in Parameter Store`)
    err.name = 'KeyNotFound'
    return err
  } else throw e
}

interface GetEmbassyOptions {
  ssm?: SSM
  audience?: string
  issuer?: string
  expiresInSecs?: number
}

/**
 * Gets an instance of Embassy to be used for the creation and verification of
 * access and refresh tokens.
 * @param ssm An instance of AWS.SSM from aws-sdk to use as a Parameter Store
 * client
 * @returns An instance of the Embassy library, pre-configured to retrieve
 * public and private keys from Parameter Store
 */
export const getEmbassy = (opts: GetEmbassyOptions = {}): Embassy => {
  const ssm = opts.ssm || new SSM(ssmOpts)
  return new Embassy({
    expiresInSecs: opts.expiresInSecs || TOKEN_EXPIRATION_SECS,
    audience: opts.audience || audience,
    issuer: opts.issuer || issuer,
    domainScopes,

    /**
     * Retrieves a private key definition. Private keys are pulled from AWS SSM
     * Parameter Store. Optionally, they can also be pulled from environment
     * variables, but this is highly discouraged because private keys should
     * never be stored where all other libraries and processes can easily access
     * them.
     * @param kid The Key ID of the private key to be retrieved
     * @returns The private key definition object
     */
    async getPrivateKey(kid: string): Promise<PrivateKeyDefinition> {
      // Check env vars first. For testing ONLY -- DO NOT USE THIS IN PROD!
      const envVar = `PRIVKEY_${kid.toUpperCase()}`
      const algorithm = JWT_ALGORITHM
      if (process.env[envVar]) {
        return {
          privateKey: (process.env[envVar] || '').replace(/\|/g, '\n'),
          algorithm,
        }
      }
      const params = {
        Name: PARAMETER_PATHS.PRIVATE_KEY(kid),
        WithDecryption: true,
      }
      try {
        const res = await ssm.getParameter(params).promise()
        if (!res.Parameter?.Value) throw new Error('Key not found')
        return {
          privateKey: res.Parameter.Value,
          algorithm: JWT_ALGORITHM,
        }
      } catch (e) {
        throw getThrowableError(e, kid)
      }
    },

    /**
     * Retrieves the public key file. Public keys are first looked for in an env
     * var titled `PUBKEY_[UPPERCASED_KEYID]`, where any pipe (`|`) characters
     * will be replaced with a newline. If not found, it will be pulled from AWS
     * SSM Parameter Store.
     * @param kid The Key ID of the public key to be retrieved
     * @returns The public key in PEM format
     */
    async getPublicKey(kid: string): Promise<string> {
      const envVar = `PUBKEY_${kid.toUpperCase()}`
      if (process.env[envVar]) {
        return (process.env[envVar] || '').replace(/\|/g, '\n')
      }
      const params = { Name: PARAMETER_PATHS.PUBLIC_KEY(kid) }
      try {
        const res = await ssm.getParameter(params).promise()
        if (!res.Parameter?.Value) throw new Error('Key not found')
        return res.Parameter.Value
      } catch (e) {
        throw getThrowableError(e, kid)
      }
    },
  })
}
