jest.mock('postmark')
import * as controllers from '../index'
import supertest from 'supertest'
import { createApp } from '@360mediadirect/restler'
import apiSpec from '../../../openapi.json'
import { embassy } from '../../lib/authorizer'
import { TEST_CONSTANTS } from '../../../../../common/constants'

const app = createApp({ apiSpec, controllers, embassy })
let token: string

describe('/users', () => {
  beforeAll(async () => {
    // Valid elliptic curve keys for token generation and verification
    process.env.PUBKEY_TEST =
      '-----BEGIN PUBLIC KEY-----|MFYwEAYHKoZIzj0CAQYFK4EEAAoDQgAEL8h4gT11geJS9H23KQAiWc0FRccEJJ8l|t0oJ2e30A7FA5IV6508SnxBC27L9JV5mSe84aLnY6lVUZsSNyDtnWg==|-----END PUBLIC KEY-----'
    process.env.PRIVKEY_TEST =
      '-----BEGIN EC PRIVATE KEY-----|MHQCAQEEIOlhAv8I1Z5luoMbI6nhsyfBRA/i5YWtE0WrrXUYuab9oAcGBSuBBAAK|oUQDQgAEL8h4gT11geJS9H23KQAiWc0FRccEJJ8lt0oJ2e30A7FA5IV6508SnxBC|27L9JV5mSe84aLnY6lVUZsSNyDtnWg==|-----END EC PRIVATE KEY-----'
    process.env.SIGNING_KEY_ID = 'TEST'
    const tokenObj = embassy.createToken({ sub: TEST_CONSTANTS.TEST_USER_ID })
    await tokenObj.grantScope('auth', 'getUsers')
    await tokenObj.grantScope('auth', 'createUser')
    await tokenObj.grantScope('auth', 'getAnyUser')
    token = await tokenObj.sign('TEST')
  })
  describe('POST /users', () => {
    it('Creates a user and Gets it and then Gets all users', async () => {
      // Run test
      const res = await supertest(app)
        .post('/users')
        .set({ Authorization: `Bearer ${token}` })
        .send({
          email: 'foo@bar.com',
          softBounceIncrement: true,
          source: 'test',
        })
      expect(res.status).toBe(200)
      expect(res.body).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          email: 'foo@bar.com',
          softBounceCount: 1,
          source: 'test',
        }),
      )

      const getRes = await supertest(app)
        .get(`/users/${res.body.id}`)
        .set({ Authorization: `Bearer ${token}` })
      expect(getRes.status).toBe(200)
      expect(getRes.body).toEqual([
        expect.objectContaining({
          id: expect.any(String),
          email: 'foo@bar.com',
          softBounceCount: 1,
          source: 'test',
        }),
      ])

      const getAllRes = await supertest(app)
        .get(`/users`)
        .set({ Authorization: `Bearer ${token}` })
      expect(getAllRes.status).toBe(200)
      expect(getAllRes.body).toEqual([
        expect.objectContaining({
          id: expect.any(String),
          email: 'foo@bar.com',
        }),
        expect.objectContaining({
          id: 'tokenTest',
          email: 'tokentest@test.com',
        }),
      ])
    })
  })
})
