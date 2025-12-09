import { BaseType } from './_BaseType'

export type IdType = 'email' | 'facebookId' | 'googleId' | 'appleId'

export interface UserIdentifier extends BaseType {
  userId: string
  idType: IdType
  lastUsedAt: number
}
