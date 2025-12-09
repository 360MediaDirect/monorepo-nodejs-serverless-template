export interface UserClient {
  clientId: string
  disabledAt?: number
  description?: string
  lastUsedAt: number
  lastEnabledAt: number
}
