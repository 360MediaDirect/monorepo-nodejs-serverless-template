/* eslint-disable @typescript-eslint/no-unsafe-function-type */
export interface ModelMetadata {
  tableName: string
  hashKey: string
  rangeKey?: string
  autoGenerateHashKey?: boolean
}

const registry = new Map<Function, ModelMetadata>()

/**
 * Registers metadata for a model class, replacing the decorator-based approach
 * from @aws/dynamodb-data-mapper-annotations
 * @param modelClass - The model class constructor
 * @param metadata - The metadata configuration for the model
 */
export function registerModel(
  modelClass: Function,
  metadata: ModelMetadata,
): void {
  registry.set(modelClass, metadata)
}

/**
 * Retrieves the registered metadata for a model class
 * @param modelClass - The model class constructor
 * @returns The metadata configuration for the model
 * @throws Error if the model class has not been registered
 */
export function getMetadata(modelClass: Function): ModelMetadata {
  const meta = registry.get(modelClass)
  if (!meta) {
    throw new Error(`Model ${modelClass.name} not registered with metadata`)
  }
  return meta
}

/**
 * Checks if a model class has been registered
 * @param modelClass - The model class constructor
 * @returns True if the model is registered, false otherwise
 */
export function hasMetadata(modelClass: Function): boolean {
  return registry.has(modelClass)
}
