jest.mock('postmark')
import * as controllers from '../index'
import supertest from 'supertest'
import { createApp } from '@360mediadirect/restler'
import apiSpec from '../../../openapi.json'
import { embassy } from '../../lib/authorizer'
import { TEST_CONSTANTS } from '../../../../../common/constants'

const app = createApp({ apiSpec, controllers, embassy })
let token: string

describe('/organizations', () => {
  beforeAll(async () => {
    // Valid elliptic curve keys for token generation and verification
    process.env.PUBKEY_TEST =
      '-----BEGIN PUBLIC KEY-----|MFYwEAYHKoZIzj0CAQYFK4EEAAoDQgAEL8h4gT11geJS9H23KQAiWc0FRccEJJ8l|t0oJ2e30A7FA5IV6508SnxBC27L9JV5mSe84aLnY6lVUZsSNyDtnWg==|-----END PUBLIC KEY-----'
    process.env.PRIVKEY_TEST =
      '-----BEGIN EC PRIVATE KEY-----|MHQCAQEEIOlhAv8I1Z5luoMbI6nhsyfBRA/i5YWtE0WrrXUYuab9oAcGBSuBBAAK|oUQDQgAEL8h4gT11geJS9H23KQAiWc0FRccEJJ8lt0oJ2e30A7FA5IV6508SnxBC|27L9JV5mSe84aLnY6lVUZsSNyDtnWg==|-----END EC PRIVATE KEY-----'
    process.env.SIGNING_KEY_ID = 'TEST'
    const tokenObj = embassy.createToken({ sub: TEST_CONSTANTS.TEST_USER_ID })
    await tokenObj.grantScope('auth', 'getOrganizations')
    token = await tokenObj.sign('TEST')
  })
  describe('GET /organizations', () => {
    it('Gets organizations by type', async () => {
      // Run test
      const res = await supertest(app)
        .get('/organizations')
        .set({ Authorization: `Bearer ${token}` })
        .send({
          type: 'publisher',
        })
      expect(res.status).toBe(200)
      expect(res.body).toEqual([
        {
          id: 'uuid-v4-here-1',
          name: 'Publisher Name',
          type: 'publisher',
          createdAt: 1636579061000,
          updatedAt: 1636579061000,
        },
      ])
    })
    it('Gets organization by ID', async () => {
      // Run test
      const res = await supertest(app)
        .get('/organizations/uuid-v4-here-1')
        .set({ Authorization: `Bearer ${token}` })
      expect(res.status).toBe(200)
      expect(res.body).toEqual([
        expect.objectContaining({
          id: 'uuid-v4-here-1',
          name: 'Publisher Name',
          type: 'publisher',
          createdAt: 1636579061000,
          updatedAt: 1636579061000,
        }),
      ])
    })
  })
})
