import { attribute } from '@aws/dynamodb-data-mapper-annotations'
import { UserClient } from '../../../../common/interfaces/UserClient'

export class UserClientModel implements UserClient {
  @attribute() clientId: string
  @attribute() description?: string
  @attribute() disabledAt?: number
  @attribute({ defaultProvider: () => Date.now() }) lastUsedAt: number
  @attribute({ defaultProvider: () => Date.now() }) lastEnabledAt: number
}
