import * as controllers from '../index'
import supertest from 'supertest'
import { createApp } from '@360mediadirect/restler'
import apiSpec from '../../../openapi.json'
import { mockPublish } from '../../__mocks__/aws-sdk'

import { embassy } from '../../lib/authorizer'

const app = createApp({ apiSpec, controllers, embassy }) as any

describe('/logs', () => {
  beforeAll(() => {
    process.env.LOG_WAREHOUSE_TOPIC_ARN = 'arn:aws:sns:us-east-1:123456789:test'
    process.env.LOG_WAREHOUSE_TABLE_NAME = 'test-log-warehouse'
  })

  beforeEach(() => {
    mockPublish.mockClear()
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
      expect(mockPublish).not.toHaveBeenCalled()
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
      expect(mockPublish).toHaveBeenCalledTimes(1)

      const publishCall = mockPublish.mock.calls[0][0]
      expect(publishCall.TopicArn).toBe('arn:aws:sns:us-east-1:123456789:test')
      expect(publishCall.MessageGroupId).toContain('test-log-warehouse')
      expect(publishCall.MessageDeduplicationId).toBeTruthy()

      const message = JSON.parse(publishCall.Message)
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
