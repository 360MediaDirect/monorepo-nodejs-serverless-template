import { docClient } from './lib/mapper'
import {
  GetCommand,
  PutCommand,
  DeleteCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb'
import { getMetadata } from './lib/metadata'
import { randomUUID } from 'crypto'
import _ from 'lodash'

export interface BaseModelProperties {
  id: string
  createdAt: number
  updatedAt: number
  deletedAt?: number
  deletedReason?: string
}

export class BaseModel implements BaseModelProperties {
  public id: string
  public createdAt: number
  public updatedAt: number
  public deletedAt?: number
  public deletedReason?: string

  /**
   * Creates a new User from existing properties
   * @param obj The properties from which to create a new User
   * @returns a new User instance
   */
  public static from<T extends BaseModel>(obj: Partial<T>): T {
    const model = new this() as T
    const partialModel = _.cloneDeep(obj)
    Object.assign(model, partialModel)
    return model
  }

  /**
   * Gets an instance of the model from the database by its key values.
   * @param keyObject - The key-value pairs to search for
   * @param indexName - Optional GSI/LSI name to query against
   * @param strongConsistent - Whether to use strong consistency for reads
   * @returns A promise that resolves to the model instance
   */
  public static async get<T extends BaseModel>(
    this: new () => T,
    keyObject: Record<string, any>,
    indexName?: string,
    strongConsistent?: boolean,
  ): Promise<T> {
    const metadata = getMetadata(this)
    let partial: Partial<T>

    if (!indexName) {
      // Direct get by primary key
      const response = await docClient.send(
        new GetCommand({
          TableName: metadata.tableName,
          Key: keyObject,
          ConsistentRead: strongConsistent,
        }),
      )
      partial = response.Item as Partial<T>
      if (!partial) {
        const error = new Error('Item not found') as any
        error.name = 'ItemNotFoundException'
        throw error
      }
    } else {
      // Query by index
      const keyConditions = Object.entries(keyObject).map(
        ([key], index) => `${key} = :val${index}`,
      )
      const expressionAttributeValues = Object.entries(keyObject).reduce(
        (acc, [, value], index) => ({ ...acc, [`:val${index}`]: value }),
        {},
      )

      const response = await docClient.send(
        new QueryCommand({
          TableName: metadata.tableName,
          IndexName: indexName,
          KeyConditionExpression: keyConditions.join(' AND '),
          ExpressionAttributeValues: expressionAttributeValues,
          ConsistentRead: strongConsistent,
          Limit: 1,
        }),
      )

      partial = response.Items?.[0] as Partial<T> | undefined
    }
    const Constructor = this as any
    return Constructor.from(partial || {})
  }

  /**
   * Soft deletes this model by setting deletedAt and deletedReason fields.
   * @param reason - Optional reason for the deletion
   * @returns A promise that resolves to the updated model instance
   */
  public async softDelete<T extends BaseModel>(reason?: string): Promise<T> {
    this.deletedReason = reason
    this.deletedAt = Date.now()
    return await this.save()
  }

  /**
   * Permanently deletes this model from the database.
   * @returns A promise that resolves when deletion is complete
   */
  public async hardDelete(): Promise<void> {
    const metadata = getMetadata(this.constructor)
    const key: Record<string, any> = {
      [metadata.hashKey]: this[metadata.hashKey],
    }
    if (metadata.rangeKey) {
      key[metadata.rangeKey] = this[metadata.rangeKey]
    }

    await docClient.send(
      new DeleteCommand({
        TableName: metadata.tableName,
        Key: key,
      }),
    )
  }

  /**
   * Saves the model to the database, updating the updatedAt timestamp.
   * Auto-generated properties are added back to this object in-place.
   * @returns A promise that resolves to the saved model instance
   */
  public async save<T extends BaseModel>(): Promise<T> {
    const metadata = getMetadata(this.constructor)

    // Generate ID if needed
    if (metadata.autoGenerateHashKey && !this[metadata.hashKey]) {
      this[metadata.hashKey] = randomUUID()
    }

    this.updatedAt = Date.now()

    await docClient.send(
      new PutCommand({
        TableName: metadata.tableName,
        Item: this,
      }),
    )

    return this as unknown as T
  }
}
