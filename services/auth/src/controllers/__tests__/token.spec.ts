jest.mock('postmark')
import * as controllers from '../index'
import supertest from 'supertest'
import { createApp } from '@360mediadirect/restler'
import apiSpec from '../../../openapi.json'
import { embassy, issuer, magicAudience } from '../../lib/authorizer'
import { TEST_CONSTANTS } from '../../../../../common/constants'
import { sns } from '../token'

const app = createApp({ apiSpec, controllers, embassy })

const { publish } = sns

describe('/token', () => {
  beforeAll(async () => {
    // Valid elliptic curve keys for token generation and verification
    process.env.PUBKEY_TEST =
      '-----BEGIN PUBLIC KEY-----|MFYwEAYHKoZIzj0CAQYFK4EEAAoDQgAEL8h4gT11geJS9H23KQAiWc0FRccEJJ8l|t0oJ2e30A7FA5IV6508SnxBC27L9JV5mSe84aLnY6lVUZsSNyDtnWg==|-----END PUBLIC KEY-----'
    process.env.PRIVKEY_TEST =
      '-----BEGIN EC PRIVATE KEY-----|MHQCAQEEIOlhAv8I1Z5luoMbI6nhsyfBRA/i5YWtE0WrrXUYuab9oAcGBSuBBAAK|oUQDQgAEL8h4gT11geJS9H23KQAiWc0FRccEJJ8lt0oJ2e30A7FA5IV6508SnxBC|27L9JV5mSe84aLnY6lVUZsSNyDtnWg==|-----END EC PRIVATE KEY-----'
    process.env.SIGNING_KEY_ID = 'TEST'

    sns.publish = jest.fn().mockImplementation((params) => {
      return { promise: () => new Promise((resolve, reject) => resolve(true)) }
    })
  })
  afterAll(() => {
    Object.assign(sns, { publish })
  })
  it('logs in successfully with a refresh token', async () => {
    const token = embassy.createToken({
      sub: 'tokenTest',
      email: 'tokentest@test.com',
    })
    const signed = await token.sign('TEST', {
      audience: issuer,
      expiresInSecs: 300,
    })
    const res = await supertest(app).post('/auth/token/refresh').send({
      token: signed,
      clientId: 'TestClient - Refresh',
    })
    expect(res.status).toBe(200)
    expect(res.body).toEqual(
      expect.objectContaining({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
      }),
    )
  })
  it('logs in successfully with a magic token', async () => {
    const token = embassy.createToken({
      sub: 'tokenTest',
      email: 'tokentest@test.com',
    })
    const signed = await token.sign('TEST', {
      audience: magicAudience,
      expiresInSecs: 300,
    })
    const res = await supertest(app).post('/auth/token/magic').send({
      token: signed,
      clientId: 'TestClient - Magic',
    })
    expect(res.status).toBe(200)
    expect(res.body).toEqual(
      expect.objectContaining({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
      }),
    )
  })
})
