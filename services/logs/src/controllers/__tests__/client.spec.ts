import * as controllers from '../index'
import supertest from 'supertest'
import { createApp } from '@360mediadirect/restler'
import apiSpec from '../../../openapi.json'

import { embassy } from '../../lib/authorizer'

const app = createApp({ apiSpec, controllers, embassy })

describe('/logs', () => {
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
    })
  })
})
