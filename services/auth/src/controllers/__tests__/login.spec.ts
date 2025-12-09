jest.mock('postmark')
// import { postmark } from '../../lib/postmark'
import * as controllers from '../index'
import supertest from 'supertest'
import { createApp } from '@360mediadirect/restler'
import apiSpec from '../../../openapi.json'
import { embassy } from '../../lib/authorizer'

const app = createApp({ apiSpec, controllers, embassy })

describe('/login', () => {
  beforeAll(() => {
    // Valid elliptic curve keys for token generation and verification
    process.env.PUBKEY_TEST =
      '-----BEGIN PUBLIC KEY-----|MFYwEAYHKoZIzj0CAQYFK4EEAAoDQgAEL8h4gT11geJS9H23KQAiWc0FRccEJJ8l|t0oJ2e30A7FA5IV6508SnxBC27L9JV5mSe84aLnY6lVUZsSNyDtnWg==|-----END PUBLIC KEY-----'
    process.env.PRIVKEY_TEST =
      '-----BEGIN EC PRIVATE KEY-----|MHQCAQEEIOlhAv8I1Z5luoMbI6nhsyfBRA/i5YWtE0WrrXUYuab9oAcGBSuBBAAK|oUQDQgAEL8h4gT11geJS9H23KQAiWc0FRccEJJ8lt0oJ2e30A7FA5IV6508SnxBC|27L9JV5mSe84aLnY6lVUZsSNyDtnWg==|-----END EC PRIVATE KEY-----'
    process.env.SIGNING_KEY_ID = 'TEST'
    process.env.MAGIC_LINK_URL = 'https://example.com/login'
  })
  beforeEach(() => {
    jest.resetAllMocks()
  })
  describe('/magic', () => {
    it('successfully requests a magic token', async () => {
      // Run test
      const res = await supertest(app).post('/auth/login/magiclink').send({
        email: 'tokentest@test.com',
      })
      expect(res.status).toBe(200)
      expect(res.body).toEqual(
        expect.objectContaining({
          message: expect.stringContaining('emailed'),
        }),
      )
      // expect(postmark.sendEmailWithTemplate).toBeCalledTimes(1)
    })
  })
})
