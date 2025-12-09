import { BaseIdType, BaseType } from './_BaseType'
import { UserClient } from './UserClient'
import { Auth } from './Auth'

export interface BaseUser extends BaseIdType {
  email: string
}

export interface User extends BaseType, BaseUser {
  dob?: string
  firstName?: string
  lastName?: string
  clients?: UserClient[]
  idTokenMinIat: number
  source: string
  subSource: string
  domainScopes?: Record<string, string[]>
  bannedAt?: number
  lastLoginAt?: number
  ipAddress?: string
  organizationId?: string
}
export interface ClientUser extends BaseUser {
  auth: Auth
}
