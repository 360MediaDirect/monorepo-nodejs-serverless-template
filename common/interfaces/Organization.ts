import { BaseType } from './_BaseType'

export interface Organization extends BaseType {
  name: string
  domainScopes?: Record<string, string[]>
}
