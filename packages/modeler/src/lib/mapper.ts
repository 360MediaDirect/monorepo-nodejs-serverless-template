import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'

const { DYNAMODB_REGION, DYNAMODB_ENDPOINT } = process.env

const client = new DynamoDBClient({
  region: DYNAMODB_REGION || process.env.AWS_REGION || 'us-east-1',
  ...(DYNAMODB_ENDPOINT && { endpoint: DYNAMODB_ENDPOINT }),
})

export const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
})

// Legacy export for backward compatibility during migration
export const mapper = docClient
