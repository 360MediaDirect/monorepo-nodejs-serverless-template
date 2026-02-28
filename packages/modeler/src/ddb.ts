import {
  DynamoDBDocumentClient,
  BatchWriteCommand,
  ScanCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb'

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export const doBatchOp = async (
  client: DynamoDBDocumentClient,
  operation: 'read' | 'put' | 'delete',
  items: any[],
  tableName: string,
  keyName?: string, // only for delete
): Promise<number> => {
  if (operation === 'put') {
    await client.send(
      new BatchWriteCommand({
        RequestItems: {
          [tableName]: items.map((item) => {
            return {
              PutRequest: {
                Item: item,
              },
            }
          }),
        },
      }),
    )
  } else if (operation === 'delete') {
    await client.send(
      new BatchWriteCommand({
        RequestItems: {
          [tableName]: items.map((item) => {
            return {
              DeleteRequest: {
                Key: {
                  [keyName as string]: item[keyName as string],
                },
              },
            }
          }),
        },
      }),
    )
  }

  await sleep(10)

  return items.length
}

export const runOpsOnItemSet = async (
  client: any,
  operation: 'read' | 'put' | 'delete',
  cb: (item: any) => Promise<{ isUpdated: true | false; updateItem: any }>,
  asyncGenerator: any,
  tableName: string,
  keyName?: string,
  isQuiet?: boolean,
): Promise<void> => {
  let updateItems: any = []
  let totalReadCount = 0
  let totalWriteCount = 0

  for await (const item of asyncGenerator) {
    totalReadCount++
    if (!isQuiet) {
      console.clear()
      console.log(
        `${totalReadCount} records read; ${totalWriteCount} records written`,
      )
    }

    const { isUpdated, updateItem } = await cb(item)
    if (isUpdated) updateItems.push(updateItem)

    if (updateItems.length >= 25) {
      totalWriteCount += await doBatchOp(
        client,
        operation,
        updateItems,
        tableName,
        keyName,
      )
      updateItems = []
      if (!isQuiet) {
        console.clear()
        console.log(
          `${totalReadCount} records read; ${totalWriteCount} records written`,
        )
      }
    }
  }

  if (updateItems.length > 0) {
    totalWriteCount += await doBatchOp(
      client,
      operation,
      updateItems,
      tableName,
      keyName,
    )
    if (!isQuiet) {
      console.clear()
      console.log(
        `${totalReadCount} records read; ${totalWriteCount} records written`,
      )
    }
  }
}

export async function* autoPaginateScan<I extends Record<string, any>>(
  docClient: DynamoDBDocumentClient,
  params: {
    TableName: string
    FilterExpression?: string
    ExpressionAttributeValues?: Record<string, any>
    ExpressionAttributeNames?: Record<string, string>
    Limit?: number
    ExclusiveStartKey?: Record<string, any>
  },
) {
  let currentParams = { ...params }

  while (true) {
    const data = await docClient.send(new ScanCommand(currentParams))

    if (data.Items && data.Items.length) {
      const items = data.Items as I[]
      yield* items
    }

    if (data.LastEvaluatedKey === undefined) {
      break
    }

    currentParams = {
      ...currentParams,
      ExclusiveStartKey: data.LastEvaluatedKey,
    }
  }
}

export const runQuery = async (
  client: DynamoDBDocumentClient,
  tableName: string,
  hashField: string,
  hashValue: string,
  rangeField?: string,
  rangeValue?: string,
  indexName?: string,
  lastEvaluatedKey?: any,
): Promise<any> => {
  const queryParams: any = {
    TableName: tableName,
    KeyConditionExpression: `${hashField} = :pkey`,
    ExpressionAttributeValues: {
      ':pkey': hashValue,
    },
    Limit: 300,
  }

  // console.log(hashField, hashValue, rangeField, rangeValue)
  if (
    rangeField !== undefined &&
    rangeValue !== undefined &&
    rangeValue !== null
  ) {
    queryParams.KeyConditionExpression += ` and ${rangeField} = :skey`
    queryParams.ExpressionAttributeValues[':skey'] = rangeValue
  }

  if (indexName !== undefined) queryParams.IndexName = indexName

  if (lastEvaluatedKey !== undefined)
    queryParams.ExclusiveStartKey = lastEvaluatedKey

  const result = await client.send(new QueryCommand(queryParams))
  return result
}
