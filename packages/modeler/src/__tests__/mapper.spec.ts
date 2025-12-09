import { mapper, ItemNotFoundException, QueryIterator } from '../lib/mapper'

describe('mapper', () => {
  it('should export mapper instance', () => {
    expect(mapper).toBeDefined()
    expect(typeof mapper.get).toBe('function')
    expect(typeof mapper.put).toBe('function')
    expect(typeof mapper.delete).toBe('function')
    expect(typeof mapper.query).toBe('function')
  })

  it('should export ItemNotFoundException', () => {
    expect(ItemNotFoundException).toBeDefined()
  })

  it('should export QueryIterator', () => {
    expect(QueryIterator).toBeDefined()
  })
})
