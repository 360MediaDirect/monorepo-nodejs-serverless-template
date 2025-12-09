import * as index from '../src/index'

describe('index', () => {
  it('exports core functions', () => {
    expect(index).toHaveProperty('createApp')
    expect(index).toHaveProperty('createController')
    expect(index).toHaveProperty('createHandler')
  })
})
