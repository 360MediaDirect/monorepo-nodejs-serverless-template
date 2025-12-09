export interface BaseIdType {
  id: string
}

export interface BaseMetadataType {
  createdAt: number
  updatedAt: number
  save: () => Promise<any>
  softDelete: () => Promise<any>
  hardDelete: () => Promise<void>
  deletedAt?: number
  deletedReason?: string
}

export interface BaseType extends BaseIdType, BaseMetadataType {}
