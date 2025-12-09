import { mapper } from './lib/mapper'
import { unwrapNumbers } from './ddb'
export { mapper }
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
    strongConsistent?: boolean
  ): Promise<T> {
    let partial: Partial<T>
    if (!indexName) {
      const queryObj = new this() as T
      Object.assign(queryObj, keyObject)
      partial = await mapper
        .get(queryObj, {
          readConsistency: strongConsistent ? 'strong' : 'eventual'
        })
        .then(unwrapNumbers)
    } else {
      for await (const result of mapper.query(this, keyObject, {
        indexName,
        readConsistency: strongConsistent ? 'strong' : 'eventual'
      })) {
        partial = unwrapNumbers(result as T)
      }
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
  public async hardDelete<T extends BaseModel>(): Promise<void> {
    await mapper.delete(this as unknown as T)
  }

  /**
   * Saves the model to the database, updating the updatedAt timestamp.
   * Auto-generated properties are added back to this object in-place.
   * @returns A promise that resolves to the saved model instance
   */
  public async save<T extends BaseModel>(): Promise<T> {
    this.updatedAt = Date.now()
    const saved = await mapper.put(this)
    const savedCopy = _.cloneDeep(saved)
    Object.assign(this, savedCopy)
    return this as unknown as T
  }
}
