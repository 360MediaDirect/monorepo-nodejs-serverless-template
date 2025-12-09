import { NumberValue } from '@aws/dynamodb-auto-marshaller'
import { DocumentClient } from 'aws-sdk/lib/dynamodb/document_client'

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function unwrapNumbers(value: any): any {
  if (value == null || value instanceof Date) {
    return value
  }
  if (NumberValue.isNumberValue(value)) {
    return value.valueOf()
  }
  if (Array.isArray(value)) {
    return value.map((i) => unwrapNumbers(i))
  }
  if (typeof value === 'object') {
    for (const key in value) {
      if (value.hasOwnProperty(key)) {
        value[key] = unwrapNumbers(value[key])
      }
    }
  }
  return value
}

export const doBatchOp = async (
  client: DocumentClient,
  operation: 'read' | 'put' | 'delete',
  items: any[],
  tableName: string,
  keyName?: string // only for delete
): Promise<number> => {
  if (operation === 'put') {
    await client
      .batchWrite({
        RequestItems: {
          [tableName]: items.map((item) => {
            return {
              PutRequest: {
                Item: item
              }
            }
          })
        }
      })
      .promise()
  } else if (operation === 'delete') {
    await client
      .batchWrite({
        RequestItems: {
          [tableName]: items.map((item) => {
            return {
              DeleteRequest: {
                Key: {
                  [keyName as string]: item[keyName as string]
                }
              }
            }
          })
        }
      })
      .promise()
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
  isQuiet?: boolean
): Promise<void> => {
  let updateItems: any = []
  let totalReadCount = 0
  let totalWriteCount = 0

  for await (const item of asyncGenerator) {
    totalReadCount++
    if (!isQuiet) {
      console.clear()
      console.log(
        `${totalReadCount} records read; ${totalWriteCount} records written`
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
        keyName
      )
      updateItems = []
      if (!isQuiet) {
        console.clear()
        console.log(
          `${totalReadCount} records read; ${totalWriteCount} records written`
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
      keyName
    )
    if (!isQuiet) {
      console.clear()
      console.log(
        `${totalReadCount} records read; ${totalWriteCount} records written`
      )
    }
  }
}

export async function* autoPaginateScan<I extends DocumentClient.AttributeMap>(
  docClient: DocumentClient,
  params: DocumentClient.ScanInput
) {
  while (true) {
    const data = await docClient.scan(params).promise()

    if (data.Items && data.Items.length) {
      const items = data.Items as I[]
      yield* items
    }

    if (data.LastEvaluatedKey === undefined) {
      break
    }

    params = { ...params, ExclusiveStartKey: data.LastEvaluatedKey }
  }
}

export const runQuery = async (
  client: any,
  tableName: string,
  hashField: string,
  hashValue: string,
  rangeField?: string,
  rangeValue?: string,
  indexName?: string,
  lastEvaluatedKey?: any
): Promise<any> => {
  const queryParams: any = {
    TableName: tableName,
    KeyConditionExpression: `${hashField} = :pkey`,
    ExpressionAttributeValues: {
      ':pkey': hashValue
    },
    Limit: 300
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

  const result = await client.query(queryParams).promise()
  return result
}
