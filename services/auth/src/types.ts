import { UserIdentifier } from '../../../common/interfaces/UserIdentifier'

/**
 * The user data to be returned by a token verifier. This syntax indicates
 * that while the payload may contain any of the optional fields, one of
 * "userId" or "identifiers" must be present.
 */
export type IdTokenPayload = {
  issuedAt?: number
  email?: string
  userId?: string
  identifiers?: UserIdentifier[]
  domainScopes?: Record<string, string[]>
} & ({ identifiers: UserIdentifier[] } | { userId: string })

export type Verifier = (token: string) => Promise<IdTokenPayload>
