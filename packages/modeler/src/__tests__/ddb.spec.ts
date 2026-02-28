import { doBatchOp, runOpsOnItemSet, autoPaginateScan, runQuery } from '../ddb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'

// Mock AWS SDK v3
const mockSend = jest.fn()

jest.mock('@aws-sdk/lib-dynamodb', () => ({
  ...jest.requireActual('@aws-sdk/lib-dynamodb'),
  DynamoDBDocumentClient: {
    from: jest.fn(() => ({ send: mockSend })),
  },
}))

describe('ddb utilities', () => {
  describe('doBatchOp', () => {
    let mockClient: DynamoDBDocumentClient

    beforeEach(() => {
      mockSend.mockClear()
      mockSend.mockResolvedValue({})
      mockClient = { send: mockSend } as any

      // Mock setTimeout to avoid actual delays in tests
      jest.spyOn(global, 'setTimeout').mockImplementation((cb: any) => {
        cb()
        return null as any
      })
    })

    afterEach(() => {
      jest.restoreAllMocks()
    })

    it('should perform batch put operations', async () => {
      const items = [
        { id: '1', name: 'Item 1' },
        { id: '2', name: 'Item 2' },
      ]
      const tableName = 'TestTable'

      const result = await doBatchOp(mockClient, 'put', items, tableName)

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: {
            RequestItems: {
              [tableName]: [
                { PutRequest: { Item: { id: '1', name: 'Item 1' } } },
                { PutRequest: { Item: { id: '2', name: 'Item 2' } } },
              ],
            },
          },
        }),
      )
      expect(result).toBe(2)
    })

    it('should perform batch delete operations', async () => {
      const items = [{ id: '1' }, { id: '2' }]
      const tableName = 'TestTable'
      const keyName = 'id'

      const result = await doBatchOp(
        mockClient,
        'delete',
        items,
        tableName,
        keyName,
      )

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: {
            RequestItems: {
              [tableName]: [
                { DeleteRequest: { Key: { id: '1' } } },
                { DeleteRequest: { Key: { id: '2' } } },
              ],
            },
          },
        }),
      )
      expect(result).toBe(2)
    })

    it('should handle read operations (no-op)', async () => {
      const items = [{ id: '1' }]
      const result = await doBatchOp(mockClient, 'read', items, 'TestTable')

      expect(mockSend).not.toHaveBeenCalled()
      expect(result).toBe(1)
    })
  })

  describe('runOpsOnItemSet', () => {
    let mockClient: DynamoDBDocumentClient
    let mockCallback: jest.MockedFunction<any>
    let mockAsyncGenerator: AsyncIterable<any>

    beforeEach(() => {
      mockSend.mockClear()
      mockSend.mockResolvedValue({})
      mockClient = { send: mockSend } as any

      mockCallback = jest.fn()

      // Mock console methods to avoid output during tests
      jest.spyOn(console, 'clear').mockImplementation()
      jest.spyOn(console, 'log').mockImplementation()

      // Mock setTimeout
      jest.spyOn(global, 'setTimeout').mockImplementation((cb: any) => {
        cb()
        return null as any
      })
    })

    afterEach(() => {
      jest.restoreAllMocks()
    })

    it('should process items and perform batch operations', async () => {
      const items = [
        { id: '1', name: 'Item 1' },
        { id: '2', name: 'Item 2' },
      ]

      mockAsyncGenerator = {
        async *[Symbol.asyncIterator]() {
          for (const item of items) {
            yield item
          }
        },
      }

      mockCallback
        .mockResolvedValueOnce({
          isUpdated: true,
          updateItem: { id: '1', name: 'Updated Item 1' },
        })
        .mockResolvedValueOnce({ isUpdated: false, updateItem: null })

      await runOpsOnItemSet(
        mockClient,
        'put',
        mockCallback,
        mockAsyncGenerator,
        'TestTable',
      )

      expect(mockCallback).toHaveBeenCalledTimes(2)
      expect(mockCallback).toHaveBeenCalledWith({ id: '1', name: 'Item 1' })
      expect(mockCallback).toHaveBeenCalledWith({ id: '2', name: 'Item 2' })

      // Only one item should trigger a batch operation (the updated one)
      expect(mockSend).toHaveBeenCalledTimes(1)
    })

    it('should batch operations when reaching 25 items', async () => {
      // Create 30 items to test batching
      const items = Array.from({ length: 30 }, (_, i) => ({ id: `${i + 1}` }))

      mockAsyncGenerator = {
        async *[Symbol.asyncIterator]() {
          for (const item of items) {
            yield item
          }
        },
      }

      // All items are updated
      mockCallback.mockImplementation(() =>
        Promise.resolve({ isUpdated: true, updateItem: { updated: true } }),
      )

      await runOpsOnItemSet(
        mockClient,
        'put',
        mockCallback,
        mockAsyncGenerator,
        'TestTable',
      )

      // Should call send twice: once for first 25 items, once for remaining 5
      expect(mockSend).toHaveBeenCalledTimes(2)
    })

    it('should run in quiet mode without console output', async () => {
      mockAsyncGenerator = {
        async *[Symbol.asyncIterator]() {
          yield { id: '1' }
        },
      }

      mockCallback.mockResolvedValue({
        isUpdated: true,
        updateItem: { id: '1' },
      })

      await runOpsOnItemSet(
        mockClient,
        'put',
        mockCallback,
        mockAsyncGenerator,
        'TestTable',
        undefined,
        true, // quiet mode
      )

      expect(console.clear).not.toHaveBeenCalled()
      expect(console.log).not.toHaveBeenCalled()
    })
  })

  describe('autoPaginateScan', () => {
    let mockDocClient: DynamoDBDocumentClient

    beforeEach(() => {
      mockSend.mockClear()
      mockDocClient = { send: mockSend } as any
    })

    it('should paginate through scan results', async () => {
      const mockScanResults = [
        {
          Items: [{ id: '1' }, { id: '2' }],
          LastEvaluatedKey: { id: '2' },
        },
        {
          Items: [{ id: '3' }],
          LastEvaluatedKey: undefined,
        },
      ]

      mockSend
        .mockResolvedValueOnce(mockScanResults[0])
        .mockResolvedValueOnce(mockScanResults[1])

      const params = { TableName: 'TestTable' }
      const generator = autoPaginateScan(mockDocClient, params)

      const results = []
      for await (const item of generator) {
        results.push(item)
      }

      expect(results).toEqual([{ id: '1' }, { id: '2' }, { id: '3' }])
      expect(mockSend).toHaveBeenCalledTimes(2)
    })

    it('should handle empty scan results', async () => {
      mockSend.mockResolvedValue({
        Items: [],
        LastEvaluatedKey: undefined,
      })

      const params = { TableName: 'TestTable' }
      const generator = autoPaginateScan(mockDocClient, params)

      const results = []
      for await (const item of generator) {
        results.push(item)
      }

      expect(results).toEqual([])
      expect(mockSend).toHaveBeenCalledTimes(1)
    })
  })

  describe('runQuery', () => {
    let mockClient: DynamoDBDocumentClient

    beforeEach(() => {
      mockSend.mockClear()
      mockSend.mockResolvedValue({
        Items: [{ id: '1', name: 'Test Item' }],
      })
      mockClient = { send: mockSend } as any
    })

    it('should run a simple query with hash key only', async () => {
      const result = await runQuery(mockClient, 'TestTable', 'pk', 'test-value')

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: {
            TableName: 'TestTable',
            KeyConditionExpression: 'pk = :pkey',
            ExpressionAttributeValues: {
              ':pkey': 'test-value',
            },
            Limit: 300,
          },
        }),
      )
      expect(result.Items).toHaveLength(1)
    })

    it('should run a query with hash and range keys', async () => {
      await runQuery(mockClient, 'TestTable', 'pk', 'test-pk', 'sk', 'test-sk')

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: {
            TableName: 'TestTable',
            KeyConditionExpression: 'pk = :pkey and sk = :skey',
            ExpressionAttributeValues: {
              ':pkey': 'test-pk',
              ':skey': 'test-sk',
            },
            Limit: 300,
          },
        }),
      )
    })

    it('should include index name when provided', async () => {
      await runQuery(
        mockClient,
        'TestTable',
        'gsi1pk',
        'test-value',
        undefined,
        undefined,
        'GSI1',
      )

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: {
            TableName: 'TestTable',
            KeyConditionExpression: 'gsi1pk = :pkey',
            ExpressionAttributeValues: {
              ':pkey': 'test-value',
            },
            Limit: 300,
            IndexName: 'GSI1',
          },
        }),
      )
    })

    it('should include LastEvaluatedKey for pagination', async () => {
      const lastKey = { pk: 'last-key' }

      await runQuery(
        mockClient,
        'TestTable',
        'pk',
        'test-value',
        undefined,
        undefined,
        undefined,
        lastKey,
      )

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: {
            TableName: 'TestTable',
            KeyConditionExpression: 'pk = :pkey',
            ExpressionAttributeValues: {
              ':pkey': 'test-value',
            },
            Limit: 300,
            ExclusiveStartKey: lastKey,
          },
        }),
      )
    })

    it('should handle null range values', async () => {
      await runQuery(
        mockClient,
        'TestTable',
        'pk',
        'test-value',
        'sk',
        null as any,
      )

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: {
            TableName: 'TestTable',
            KeyConditionExpression: 'pk = :pkey',
            ExpressionAttributeValues: {
              ':pkey': 'test-value',
            },
            Limit: 300,
          },
        }),
      )
    })
  })
})
