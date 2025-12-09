import { DataMapper } from '@aws/dynamodb-data-mapper'
import DynamoDB from 'aws-sdk/clients/dynamodb'

export { ItemNotFoundException, QueryIterator } from '@aws/dynamodb-data-mapper'

const { DYNAMODB_REGION, DYNAMODB_ENDPOINT } = process.env

const mapper = new DataMapper({
  client: new DynamoDB({
    region: DYNAMODB_REGION || process.env.AWS_REGION || 'us-east-1',
    ...(DYNAMODB_ENDPOINT && { endpoint: DYNAMODB_ENDPOINT }),
  }),
})

export { mapper }
