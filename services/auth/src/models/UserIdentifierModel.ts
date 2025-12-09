import {
  hashKey,
  table,
  attribute,
} from '@aws/dynamodb-data-mapper-annotations'
import { BaseModel } from '@360mediadirect/modeler'
import {
  UserIdentifier,
  IdType,
} from '../../../../common/interfaces/UserIdentifier'
import { UserModel } from './UserModel'
import createError from 'http-errors'
import { Schema } from '@aws/dynamodb-data-marshaller'

export const ddbSchemaUserId: Schema = {
  id: { type: 'String' },
  createdAt: { type: 'Number' },
  updatedAt: { type: 'Number' },
  deletedAt: { type: 'Number' },
  deletedReason: { type: 'String' },
  userId: { type: 'String' },
  idType: { type: 'String' },
  lastUsedAt: { type: 'Number' },
}

@table(process.env.USER_IDENTIFIER_TABLE_NAME)
export class UserIdentifierModel extends BaseModel implements UserIdentifier {
  @hashKey() id: string
  @attribute() userId: string
  @attribute() idType: IdType
  @attribute({ defaultProvider: () => Date.now() })
  lastUsedAt: number
  @attribute({ defaultProvider: () => Date.now() })
  createdAt: number
  @attribute({ defaultProvider: () => Date.now() })
  updatedAt: number
  deletedAt: number

  /**
   * Gets a user by the ID of one of its identifiers
   * @param id - The ID of a user identifier to look up
   * @returns the user identified by the given identifier ID
   * @throws ItemNotFoundException if the user or identifier does not exist
   */
  static async getUser(id: string): Promise<UserModel>

  /**
   * Gets a user by the first matching ID in a list of IDs
   * @param ids - An array of IDs to iterate through until a user is found
   * @returns the user associated with the first existing identifier
   * @throws ItemNotFoundException if the user or identifier does not exist
   */
  static async getUser(ids: string[]): Promise<UserModel>
  static async getUser(idOrArray: string[] | string): Promise<UserModel> {
    const ids = Array.isArray(idOrArray) ? idOrArray : [idOrArray]
    for (let i = 0; i < ids.length; i++) {
      const id = { id: ids[i] }
      const isLast = i === ids.length - 1
      try {
        const ident = (await UserIdentifierModel.get(id)) as UserIdentifierModel
        const user = (await UserModel.get({ id: ident.userId })) as UserModel
        return user
      } catch (e) {
        // The user was not found or an error occurred. If the error is anything
        // other than ItemNotFound, it should be thrown. Otherwise throw
        // ItemNotFound if this was our last chance at finding the user.
        if (e.name !== 'ItemNotFoundException' || isLast) throw e
      }
    }
  }

  /**
   * Given an array of identifiers for a user (commonly email + social ID), this
   * function will search for a matching user. If found, the identifiers
   * provided will be saved in reference to that user, and the User record will
   * be returned. Otherwise, HTTP error 401 will be thrown.
   * @param identifiers - An array of user identifiers that should be linked to
   * the user logging in
   * @returns The user matching any of the given identifiers
   * @throws HTTP 401 if none of the given identifiers match a user
   */
  static async getUserAndPushIdentifiers(
    identifiers: UserIdentifier[],
  ): Promise<UserModel> {
    let user: UserModel
    for (let i = 0; i < identifiers.length; i++) {
      const ident = identifiers[i]
      try {
        user = await UserIdentifierModel.getUser(ident.id)
        break
      } catch (e) {
        if (e.name !== 'ItemNotFoundException') throw e
        continue
      }
    }
    if (!user) throw createError(401)
    await UserIdentifierModel.pushIdentifiers(user.id, identifiers)
    return user
  }

  /**
   * Upserts all provided identifiers simultaneously.
   * @param userId - The ID of the user associated with the given identifiers
   * @param identifiers - An array of UserIdentifierModels to be upserted
   */
  static async pushIdentifiers(
    userId: string,
    identifiers: UserIdentifier[],
  ): Promise<void> {
    await Promise.all(
      identifiers.map((ident) =>
        UserIdentifierModel.upsert(userId, ident.idType, ident.id),
      ),
    )
  }

  static async upsert(
    userId: string,
    idType: IdType,
    id: string | number,
  ): Promise<UserIdentifierModel> {
    const idStr = `${id}`
    let obj: UserIdentifierModel
    try {
      const queryObj = UserIdentifierModel.from({ id: idStr })
      obj = (await UserIdentifierModel.get(queryObj)) as UserIdentifierModel
    } catch (e) {
      if (e.name !== 'ItemNotFoundException') throw e
      obj = UserIdentifierModel.from<UserIdentifierModel>({
        id: idStr,
        idType,
        userId,
      }) as UserIdentifierModel
    }
    obj.lastUsedAt = Date.now()
    await obj.save()
    return obj
  }
}
