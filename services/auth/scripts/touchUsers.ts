/*
 * touchUsers
 *
 * Scans through the users table and updates the updatedAt record to now.
 * Currently filters to only target users with an existing "clients" key.
 *
 * HOW TO USE:
 * 1. Update the USERS_TABLE param to target the environment you want
 * 2. Update the FilterExpression at the top of the scanAndUpdate() function
 *    to have the filter criteria you need
 * 3. Execute from the scripts directory with:
 *    AWS_REGION=wrss ts-node ./touchUsers.ts
 *
 */

import { DynamoDB } from 'aws-sdk'
import { TABLE_NAMES } from '../../../common/constants'

const USERS_TABLE = TABLE_NAMES.USERS_PROD

const dynamoDB = new DynamoDB.DocumentClient({
  region: 'us-east-1',
})

const updateParamsTemplate = {
  TableName: USERS_TABLE,
  Key: null,
  UpdateExpression: 'set updatedAt = :t',
  ExpressionAttributeValues: { ':t': Date.now() },
}

const scanAndUpdate = async () => {
  const params: DynamoDB.DocumentClient.ScanInput = {
    TableName: USERS_TABLE,
    FilterExpression: 'attribute_exists(clients)',
  }
  let result: DynamoDB.DocumentClient.ScanOutput
  do {
    result = await dynamoDB.scan(params).promise()
    await Promise.all(
      result.Items?.map(async (item) => {
        const updateParams = {
          ...updateParamsTemplate,
          Key: { id: item.id },
        }
        console.log(`Updating ${item.id}`)
        await dynamoDB.update(updateParams).promise()
      }),
    )
    params.ExclusiveStartKey = result.LastEvaluatedKey
  } while (typeof result.LastEvaluatedKey !== 'undefined')
}

scanAndUpdate().then(console.log, console.error)
