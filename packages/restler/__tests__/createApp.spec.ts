import { createApp } from '../src/createApp'
import supertest from 'supertest'
import path from 'path'
import * as controllers from '../__fixtures__/controllers'
import { getEmbassy } from '../../../common/auth/getEmbassy'

const specPath = path.resolve(__dirname, '../__fixtures__/openapi.yml')
const embassy = getEmbassy()
const opts = { specPath, embassy, controllers }
const token = embassy.createToken({
  sub: '123456',
  email: 'test@test.com'
})
let noScopeToken = ''
let scopedToken = ''

const getLogSpy = () => {
  return {
    child() {
      return this
    },
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}
let log = getLogSpy()

describe('createApp', () => {
  beforeAll(async () => {
    process.env.PUBKEY_TEST =
      '-----BEGIN PUBLIC KEY-----|MFYwEAYHKoZIzj0CAQYFK4EEAAoDQgAEL8h4gT11geJS9H23KQAiWc0FRccEJJ8l|t0oJ2e30A7FA5IV6508SnxBC27L9JV5mSe84aLnY6lVUZsSNyDtnWg==|-----END PUBLIC KEY-----'
    process.env.PRIVKEY_TEST =
      '-----BEGIN EC PRIVATE KEY-----|MHQCAQEEIOlhAv8I1Z5luoMbI6nhsyfBRA/i5YWtE0WrrXUYuab9oAcGBSuBBAAK|oUQDQgAEL8h4gT11geJS9H23KQAiWc0FRccEJJ8lt0oJ2e30A7FA5IV6508SnxBC|27L9JV5mSe84aLnY6lVUZsSNyDtnWg==|-----END EC PRIVATE KEY-----'
    process.env.PRIVKEY_HMAC = 'abc123'
    noScopeToken = await token.sign('test')
    await token.grantScope('auth', 'createUser')
    scopedToken = await token.sign('test')
  })
  beforeEach(() => (log = getLogSpy()))
  it('creates an Express app without error', () => {
    createApp(opts)
  })
  it('returns 200 from a controlled endpoint', async () => {
    const app = createApp(opts)
    const res = await supertest(app).get('/foo/bar')
    expect(res.status).toEqual(200)
    expect(res.body).toEqual({ id: 'bar' })
  })
  it('returns 404 from a nonexistent endpoint', async () => {
    const app = createApp(opts)
    const res = await supertest(app).get('/tek/foo')
    expect(res.status).toEqual(404)
    expect(res.body).toEqual(expect.objectContaining({ error: 'Not Found' }))
  })
  it('redacts request fields', async () => {
    const app = createApp({ ...opts, log })
    const res = await supertest(app)
      .post('/baz')
      .send({ user: 'foo', password: 'bar' })
    expect(res.status).toEqual(201)
    expect(log.info).toBeCalledTimes(2)
    expect(log.info.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        body: {
          user: 'foo',
          password: '(REDACTED)'
        }
      })
    )
  })
  it('redacts response fields', async () => {
    const app = createApp({ ...opts, log })
    const res = await supertest(app)
      .put('/baz')
      .send({ user: 'foo', password: 'bar' })
    expect(res.status).toEqual(200)
    expect(res.body).toEqual({ msg: 'foo', token: 'bar' })
    expect(log.info).toBeCalledTimes(2)
    expect(log.info.mock.calls[1][1]).toEqual(
      expect.objectContaining({
        body: {
          msg: 'foo',
          token: '(REDACTED)'
        }
      })
    )
  })
  it('sends 500 on JS error throws', async () => {
    const app = createApp({ ...opts, log })
    const res = await supertest(app).post('/error').send({ foo: 'bar' })
    expect(res.status).toEqual(500)
    expect(res.body).toEqual({ error: 'Internal server error' })
    expect(log.info).toBeCalledTimes(2)
    expect(log.info.mock.calls[1][1]).toEqual(
      expect.objectContaining({
        body: { error: 'Internal server error' }
      })
    )
    expect(log.error).toBeCalledTimes(1)
    expect(log.error.mock.calls[0][1]).toBeInstanceOf(Error)
  })
  it('sends 400 when missing required request fields', async () => {
    const app = createApp(opts)
    const res = await supertest(app).post('/foo').send({ bar: 'test@test.com' })
    expect(res.status).toEqual(400)
    expect(res.body).toEqual(
      expect.objectContaining({
        error: expect.stringContaining("required property 'foo'")
      })
    )
  })
  it('sends 400 when missing improperly formatted fields', async () => {
    const app = createApp(opts)
    const res = await supertest(app).post('/foo').send({ foo: 'foo', bar: 'b' })
    expect(res.status).toEqual(400)
    expect(res.body).toEqual(
      expect.objectContaining({
        error: expect.stringContaining('bar should match format "email"')
      })
    )
  })
  it('sends 401 when calling a secure endpoint with no token', async () => {
    const app = createApp(opts)
    const res = await supertest(app).get('/foo')
    expect(res.status).toEqual(401)
    expect(res.body).toEqual(
      expect.objectContaining({
        error: 'Authorization header required'
      })
    )
  })
  it('sends 401 when calling a secure endpoint with malformed token', async () => {
    const app = createApp(opts)
    const res = await supertest(app)
      .get('/foo')
      .set('Authorization', 'Bearer 123456')
    expect(res.status).toEqual(401)
    expect(res.body).toEqual(expect.objectContaining({ error: 'Unauthorized' }))
  })
  it('sends a 403 when a token is missing required scopes', async () => {
    const app = createApp(opts)
    const res = await supertest(app)
      .get('/foo')
      .set('Authorization', `Bearer ${noScopeToken}`)
    expect(res.status).toEqual(403)
    expect(res.body).toEqual(expect.objectContaining({ error: 'Forbidden' }))
  })
  it('applies a custom cache-control header', async () => {
    const app = createApp(opts)
    const res = await supertest(app)
      .get('/foo')
      .set('Authorization', `Bearer ${scopedToken}`)
    expect(res.status).toEqual(200)
    expect(res.body).toEqual({ controller: 'getAllFoo' })
    expect(res.get('Cache-Control')).toEqual('public')
  })
  it('approves a valid access token', async () => {
    const app = createApp(opts)
    const res = await supertest(app)
      .get('/foo')
      .set('Authorization', `Bearer ${scopedToken}`)
    expect(res.status).toEqual(200)
    expect(res.body).toEqual({ controller: 'getAllFoo' })
  })
  it('allows controllers to end with a status code but no body', async () => {
    const app = createApp(opts)
    const res = await supertest(app).post('/bar').send({ bar: 'bar' })
    expect(res.status).toEqual(204)
    expect(res.body).toEqual({})
  })
  it('allows "silent" to be used to bypass req/res logging', async () => {
    const app = createApp({ ...opts, log })
    // x-restler-request-redact and x-restler-response-redact should both be
    // set to the string "silent" for this endpoint
    const res = await supertest(app).post('/bar').send({ bar: 'bar' })
    expect(res.status).toEqual(204)
    expect(res.body).toEqual({})
    expect(log.info).not.toBeCalled()
  })
  it('allows "body" to be used to redact entire req/res body', async () => {
    const app = createApp({ ...opts, log })
    // x-restler-request-redact and x-restler-response-redact should both be
    // set to the string "body" for this endpoint
    const res = await supertest(app).put('/bar').send({ bar: 'bar' })
    expect(res.status).toEqual(200)
    expect(res.body).toEqual('bar')
    expect(log.info).toBeCalledTimes(2)
    expect(log.info.mock.calls[0][1]).toHaveProperty(
      'body',
      'REDACTED object[1]'
    )
    expect(log.info.mock.calls[1][1]).toHaveProperty(
      'body',
      'REDACTED string[3]'
    )
  })
})
