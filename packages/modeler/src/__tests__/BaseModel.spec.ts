import { BaseModel, mapper } from '../BaseModel'
import { unwrapNumbers } from '../ddb'

// Mock the dependencies
jest.mock('../lib/mapper')
jest.mock('../ddb')

const mockedMapper = mapper as jest.Mocked<typeof mapper>
const mockedUnwrapNumbers = unwrapNumbers as jest.MockedFunction<
  typeof unwrapNumbers
>

// Create a test model class for testing
class TestModel extends BaseModel {
  public name: string
  public email: string

  constructor() {
    super()
    this.name = ''
    this.email = ''
  }
}

describe('BaseModel', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedUnwrapNumbers.mockImplementation((value) => value)
  })

  describe('from', () => {
    it('should create a new instance from partial data', () => {
      const data = {
        id: 'test-id',
        name: 'Test Name',
        email: 'test@example.com',
        createdAt: 1234567890,
        updatedAt: 1234567890
      }

      const model = TestModel.from<TestModel>(data)

      expect(model).toBeInstanceOf(TestModel)
      expect(model.id).toBe('test-id')
      expect(model.name).toBe('Test Name')
      expect(model.email).toBe('test@example.com')
      expect(model.createdAt).toBe(1234567890)
      expect(model.updatedAt).toBe(1234567890)
    })

    it('should handle empty partial data', () => {
      const model = TestModel.from<TestModel>({})

      expect(model).toBeInstanceOf(TestModel)
      expect(model.name).toBe('')
      expect(model.email).toBe('')
    })

    it('should create a deep copy of the input data', () => {
      const nestedData = {
        id: 'test-id',
        metadata: { nested: 'value' }
      }

      const model = TestModel.from<TestModel>(nestedData as any)

      // Modify the original data
      ;(nestedData as any).metadata.nested = 'modified'

      expect((model as any).metadata.nested).toBe('value')
    })
  })

  describe('get', () => {
    it('should get a model by key without index', async () => {
      const mockResult = {
        id: 'test-id',
        name: 'Test Name',
        createdAt: 1234567890
      }

      mockedMapper.get.mockResolvedValue(mockResult as any)
      mockedUnwrapNumbers.mockReturnValue(mockResult)

      const result = await TestModel.get<TestModel>({ id: 'test-id' })

      expect(mockedMapper.get).toHaveBeenCalledWith(expect.any(TestModel), {
        readConsistency: 'eventual'
      })
      expect(result).toBeInstanceOf(TestModel)
      expect(result.id).toBe('test-id')
      expect(result.name).toBe('Test Name')
    })

    it('should get a model with strong consistency', async () => {
      const mockResult = { id: 'test-id' }
      mockedMapper.get.mockResolvedValue(mockResult as any)
      mockedUnwrapNumbers.mockReturnValue(mockResult)

      await TestModel.get<TestModel>({ id: 'test-id' }, undefined, true)

      expect(mockedMapper.get).toHaveBeenCalledWith(expect.any(TestModel), {
        readConsistency: 'strong'
      })
    })

    it('should get a model by querying an index', async () => {
      const mockResult = { id: 'test-id', email: 'test@example.com' }
      const mockAsyncIterable = {
        async *[Symbol.asyncIterator]() {
          yield mockResult
        }
      }

      mockedMapper.query.mockReturnValue(mockAsyncIterable as any)
      mockedUnwrapNumbers.mockReturnValue(mockResult)

      const result = await TestModel.get<TestModel>(
        { email: 'test@example.com' },
        'email-index'
      )

      expect(mockedMapper.query).toHaveBeenCalledWith(
        TestModel,
        { email: 'test@example.com' },
        {
          indexName: 'email-index',
          readConsistency: 'eventual'
        }
      )
      expect(result.email).toBe('test@example.com')
    })

    it('should handle query with strong consistency on index', async () => {
      const mockResult = { id: 'test-id' }
      const mockAsyncIterable = {
        async *[Symbol.asyncIterator]() {
          yield mockResult
        }
      }

      mockedMapper.query.mockReturnValue(mockAsyncIterable as any)
      mockedUnwrapNumbers.mockReturnValue(mockResult)

      await TestModel.get<TestModel>({ id: 'test-id' }, 'test-index', true)

      expect(mockedMapper.query).toHaveBeenCalledWith(
        TestModel,
        { id: 'test-id' },
        {
          indexName: 'test-index',
          readConsistency: 'strong'
        }
      )
    })
  })

  describe('softDelete', () => {
    it('should soft delete a model with reason', async () => {
      const model = new TestModel()
      model.id = 'test-id'
      model.updatedAt = 1000

      const mockSavedModel = {
        ...model,
        deletedAt: 1234567890,
        deletedReason: 'test reason'
      }
      mockedMapper.put.mockResolvedValue(mockSavedModel as any)

      const originalDateNow = Date.now
      Date.now = jest.fn(() => 1234567890)

      const result = await model.softDelete('test reason')

      expect(model.deletedAt).toBe(1234567890)
      expect(model.deletedReason).toBe('test reason')
      expect(mockedMapper.put).toHaveBeenCalledWith(model)
      expect(result).toBe(model)

      Date.now = originalDateNow
    })

    it('should soft delete a model without reason', async () => {
      const model = new TestModel()
      model.id = 'test-id'

      const mockSavedModel = { ...model, deletedAt: 1234567890 }
      mockedMapper.put.mockResolvedValue(mockSavedModel as any)

      const originalDateNow = Date.now
      Date.now = jest.fn(() => 1234567890)

      await model.softDelete()

      expect(model.deletedAt).toBe(1234567890)
      expect(model.deletedReason).toBeUndefined()

      Date.now = originalDateNow
    })
  })

  describe('hardDelete', () => {
    it('should permanently delete a model', async () => {
      const model = new TestModel()
      model.id = 'test-id'

      mockedMapper.delete.mockResolvedValue(undefined as any)

      await model.hardDelete()

      expect(mockedMapper.delete).toHaveBeenCalledWith(model)
    })
  })

  describe('save', () => {
    it('should save a model and update timestamps', async () => {
      const model = new TestModel()
      model.id = 'test-id'
      model.name = 'Test Name'
      model.createdAt = 1000
      model.updatedAt = 1000

      const mockSavedModel = {
        ...model,
        updatedAt: 1234567890,
        createdAt: 1234567890
      }
      mockedMapper.put.mockResolvedValue(mockSavedModel as any)

      const originalDateNow = Date.now
      Date.now = jest.fn(() => 1234567890)

      const result = await model.save()

      expect(model.updatedAt).toBe(1234567890)
      expect(mockedMapper.put).toHaveBeenCalledWith(model)
      expect(result).toBe(model)
      expect(model.createdAt).toBe(1234567890) // Should be updated from saved result

      Date.now = originalDateNow
    })

    it('should handle mapper errors', async () => {
      const model = new TestModel()
      model.id = 'test-id'

      const error = new Error('DynamoDB error')
      mockedMapper.put.mockRejectedValue(error)

      await expect(model.save()).rejects.toThrow('DynamoDB error')
    })
  })

  describe('BaseModelProperties interface', () => {
    it('should enforce required properties', () => {
      const model = new TestModel()
      // Initialize required properties
      model.id = 'test-id'
      model.createdAt = Date.now()
      model.updatedAt = Date.now()

      // These should all exist on the model
      expect(typeof model.id).toBe('string')
      expect(typeof model.createdAt).toBe('number')
      expect(typeof model.updatedAt).toBe('number')
      expect(model.deletedAt).toBeUndefined()
      expect(model.deletedReason).toBeUndefined()
    })
  })
})
