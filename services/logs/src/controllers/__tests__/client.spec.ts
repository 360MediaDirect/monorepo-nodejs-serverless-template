import * as controllers from '../index'
import supertest from 'supertest'
import { createApp } from '@360mediadirect/restler'
import apiSpec from '../../openapi.json'
import { mockSend } from '../../__mocks__/@aws-sdk/client-sns'

import { embassy } from '../../lib/authorizer'

const app = createApp({ apiSpec, controllers, embassy }) as any

describe('/logs', () => {
  beforeAll(() => {
    process.env.LOG_WAREHOUSE_TOPIC_ARN = 'arn:aws:sns:us-east-1:123456789:test'
    process.env.LOG_WAREHOUSE_TABLE_NAME = 'test-log-warehouse'
  })

  beforeEach(() => {
    mockSend.mockClear()
  })

  describe('/client', () => {
    it('successfully logs a message', async () => {
      const res = await supertest(app)
        .post('/logs/client')
        .send({
          level: 'info',
          message: 'Foo bar',
          data: { foo: 'bar' },
        })
      expect(res.status).toBe(204)
      expect(res.body).toEqual({})
      expect(mockSend).not.toHaveBeenCalled()
    })

    it('successfully logs a message and publishes to warehouse', async () => {
      const res = await supertest(app)
        .post('/logs/client')
        .send({
          level: 'warn',
          message: 'Warning message',
          data: { foo: 'bar', toWarehouse: true },
        })
      expect(res.status).toBe(204)
      expect(res.body).toEqual({})
      expect(mockSend).toHaveBeenCalledTimes(1)

      const publishCommand = mockSend.mock.calls[0][0]
      expect(publishCommand.input.TopicArn).toBe(
        'arn:aws:sns:us-east-1:123456789:test',
      )
      expect(publishCommand.input.MessageGroupId).toContain(
        'test-log-warehouse',
      )
      expect(publishCommand.input.MessageDeduplicationId).toBeTruthy()

      const message = JSON.parse(publishCommand.input.Message)
      expect(message.tableName).toBe('test-log-warehouse')
      expect(message.entityRecord).toMatchObject({
        level: 'warn',
        message: 'Warning message',
        data: { foo: 'bar' },
      })
      expect(message.entityRecord.id).toBeTruthy()
      expect(message.entityRecord.timestamp).toBeTruthy()
      expect(message.entityRecord.data.toWarehouse).toBeUndefined()
    })
  })
})
