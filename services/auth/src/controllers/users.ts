import { createController } from '@360mediadirect/restler'
import log from '@360mediadirect/log'
import createError from 'http-errors'
import { UserModel } from '../models/UserModel'
import { UserIdentifierModel } from '../models/UserIdentifierModel'

/**
 * Creates or updates a user by merging user data in the following order,
 * where later items overwrite earlier items:
 *
 * - Existing user data (if present in the database)
 * - User data from request body
 */
export const createUser = createController(async (req, res) => {
  // Prevent request from overwriting or prescribing the id field
  const userData = req.body
  delete userData.id
  const cleanEmail = userData.email.trim().toLowerCase()
  let user: UserModel
  try {
    // Get the existing database user
    user = await UserIdentifierModel.getUser(cleanEmail)
    Object.assign(user, userData)
  } catch (e) {
    if (e.name !== 'ItemNotFoundException') throw e
    // The user does not already exist in the database; create a new record
    user = UserModel.from<UserModel>(userData) as UserModel
  }

  // tracking soft bounces
  if (userData.softBounceIncrement) {
    if (user.softBounceCount !== undefined) user.softBounceCount++
    else user.softBounceCount = 1
    delete user.softBounceIncrement
  }

  await user.save()

  // Ensure that the user's email is saved to use for login
  await UserIdentifierModel.upsert(user.id, 'email', cleanEmail)
  res.json(user)
})

/**
 * Get a user by internal id
 */
export const getUserById = createController(async (req, res) => {
  const { id } = req.params
  if (
    id !== req.token?.claims?.sub &&
    !(await req.token?.hasScope('auth|getAnyUser'))
  ) {
    throw createError(403, 'Not allowed to get any user')
  }
  log.debug('Get User By Id', { id })
  const user = await UserModel.get({ id })
  res.status(200).json([user])
})

/**
 * Lists 25 users at a time, paginating by the lastEvaluatedKey query value.
 * Optionally, an `email` query can be specified to simply retrieve the user
 * with that identifier.
 */
export const getUsers = createController(async (req, res) => {
  const { lastEvaluatedKey, email } = req.query
  let users = []
  if (email) {
    // An email was specified, so just get the matching user
    const cleanEmail = (email as string).trim().toLowerCase()
    const user = await UserIdentifierModel.getUser(cleanEmail)
    if (!user.deletedAt) users.push(user)
  } else {
    users = await UserModel.getActiveUsers(
      25,
      lastEvaluatedKey as Record<string, any>,
    )
  }
  res.status(200).json(users)
})
