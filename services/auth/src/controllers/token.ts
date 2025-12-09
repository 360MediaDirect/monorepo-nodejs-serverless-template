import { createController, Logger } from '@360mediadirect/restler'
import createError from 'http-errors'
import AWS from 'aws-sdk'

import { UserModel } from '../models/UserModel'
import { UserIdentifierModel } from '../models/UserIdentifierModel'
import { Verifier, IdTokenPayload } from '../types'
import * as verifiers from '../verifiers'
import { AUTH_ERROR_CODES } from '../../../../common/constants'

export const sns = new AWS.SNS()

const notLinkedError = createError(
  401,
  "Sorry, this login doesn't appear to be tied to a Click-N-Read Mags account! Please use another method.",
  { errorCode: AUTH_ERROR_CODES.TOKEN_NOT_LINKED },
)

/**
 * Verifies the validity of the provided token, extracting all applicable user
 * data into a payload object.
 * @param log - The log function to use for failure warnings
 * @param tokenType - The name of the verifier to be used for this token
 * @param token - The token string to be verified
 * @returns a payload of data derived from the verified token
 * @throws HTTP 401 with errorCode "INVALID_TOKEN" if verification fails
 */
const getPayload = async (
  log: Logger,
  tokenType: string,
  token: string,
): Promise<IdTokenPayload> => {
  const verify: Verifier = verifiers[tokenType]
  if (!verify) throw createError(404)
  try {
    const payload = await verify(token)
    log.info('Token Payload', { payload })
    return payload
  } catch (e) {
    log.warn('Token failed verification', { tokenType, token }, e)
    // Only create a 401 if the error isn't already an http-error
    throw e.status
      ? e
      : createError(401, 'Failed to log in. Please try again.', {
          errorCode: AUTH_ERROR_CODES.INVALID_TOKEN,
        })
  }
}

/**
 * Retrieves an existing user account using the data supplied in a token
 * verification payload.
 * @param log - The log function to use for failure warnings
 * @param payload - The payload from a verified token
 * @returns a user record matching at least one identifier from the payload
 * @throws HTTP 401 with errorCode "TOKEN_NOT_LINKED" if none of the user
 * identifiers in the payload can be matched with an existing user account
 */
const getUser = async (
  log: Logger,
  payload: IdTokenPayload,
): Promise<UserModel> => {
  // Get the existing user and update its identifiers
  try {
    const user = payload.userId
      ? ((await UserModel.get({ id: payload.userId })) as UserModel)
      : await UserIdentifierModel.getUserAndPushIdentifiers(payload.identifiers)
    return user
  } catch (e) {
    if (e.name !== 'ItemNotFoundException' && e.status !== 401) throw e
    if (e.status === 404) throw notLinkedError
  }
}

export const loginWithToken = createController(async (req, res) => {
  const { tokenType } = req.params
  const { token, clientId, clientDescription, requiredScopes, product } =
    req.body || {}
  const payload = await getPayload(req.log, tokenType, token)
  const user = await getUser(req.log, payload)
  const minTime = user.idTokenMinIat || 0
  if (payload.issuedAt) {
    const iatTime = payload.issuedAt
    if (minTime > iatTime) {
      req.log.warn('User attempted sign-in with manually expired token', {
        user,
        payload,
        tokenType,
        minTime,
        iatTime,
      })
      throw createError(
        401,
        'For your account security, please sign in again.',
        {
          errorCode: AUTH_ERROR_CODES.INVALID_TOKEN,
        },
      )
    }
  }

  const accessTokenOptions = {
    method: tokenType,
    client: {
      clientId,
      description: clientDescription,
    },
    ip: req.ip,
    domainScopes: payload.domainScopes,
    requiredScopes,
  }
  const accessToken = await user.login(accessTokenOptions)
  const refreshToken = await user.createRefreshToken()

  if (!['api@periodical.com', 'api@360mediadirect.com'].includes(payload.email))
    await sns
      .publish({
        TopicArn: process.env.AUTH_WAREHOUSE_TOPIC_ARN,
        Message: JSON.stringify({
          tableName: process.env.LOGS_WAREHOUSE_TABLE_NAME,
          entityRecord: {
            id: req.id,
            payload,
            product,
            accessTokenOptions,
            timestamp: Date.now(),
          },
          cKeys: ['id'],
        }),
        MessageDeduplicationId: `${req.id}_${Date.now()}`,
        MessageGroupId: `${process.env.LOGS_WAREHOUSE_TABLE_NAME}_${req.id}`,
      })
      .promise()
      .catch((e) => console.error(e))

  res.json({ accessToken, refreshToken })
})
