import { httpHandler } from '../index'

describe('httpHandler', () => {
  it('exposes a handler function', () => {
    expect(httpHandler.length).toBe(3)
  })
})
