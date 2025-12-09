import { redact } from '../../src/lib/redact'

describe('redact', () => {
  it('should redact specified fields from an object', () => {
    const obj = {
      username: 'testuser',
      password: 'secret123',
      email: 'test@example.com',
    }

    const result = redact(obj, ['password'])

    expect(result).toEqual({
      username: 'testuser',
      password: '(REDACTED)',
      email: 'test@example.com',
    })
  })

  it('should redact multiple fields', () => {
    const obj = {
      username: 'testuser',
      password: 'secret123',
      token: 'abc123',
      email: 'test@example.com',
    }

    const result = redact(obj, ['password', 'token'])

    expect(result).toEqual({
      username: 'testuser',
      password: '(REDACTED)',
      token: '(REDACTED)',
      email: 'test@example.com',
    })
  })

  it('should handle fields that do not exist in the object', () => {
    const obj = {
      username: 'testuser',
      email: 'test@example.com',
    }

    const result = redact(obj, ['password', 'token'])

    expect(result).toEqual({
      username: 'testuser',
      email: 'test@example.com',
    })
  })

  it('should return a shallow copy, not modifying the original', () => {
    const obj = {
      username: 'testuser',
      password: 'secret123',
      nested: { secret: 'value' },
    }

    const result = redact(obj, ['password'])

    expect(result).not.toBe(obj)
    expect(obj.password).toBe('secret123') // Original unchanged
    expect(result!.password).toBe('(REDACTED)')
    expect(result!.nested).toBe(obj.nested) // Shallow copy
  })

  it('should handle null input', () => {
    const result = redact(null, ['field'])
    expect(result).toBeNull()
  })

  it('should handle undefined input', () => {
    const result = redact(undefined, ['field'])
    expect(result).toBeUndefined()
  })

  it('should handle empty fields array', () => {
    const obj = {
      username: 'testuser',
      password: 'secret123',
    }

    const result = redact(obj, [])

    expect(result).toEqual({
      username: 'testuser',
      password: 'secret123',
    })
  })

  it('should handle objects with own properties correctly', () => {
    const obj = {
      ownProp: 'own',
      secret: 'secret123',
      publicData: 'public',
    }

    const result = redact(obj, ['secret', 'nonExistentField'])

    // Should only redact own properties that exist
    expect(result!.secret).toBe('(REDACTED)')
    expect(result!.ownProp).toBe('own')
    expect(result!.publicData).toBe('public')
    // Non-existent field should not cause issues
    expect((result as any).nonExistentField).toBeUndefined()
  })

  it('should handle objects with various data types', () => {
    const obj = {
      string: 'test',
      number: 123,
      boolean: true,
      array: [1, 2, 3],
      object: { nested: 'value' },
      nullValue: null,
      undefinedValue: undefined,
    }

    const result = redact(obj, ['number', 'boolean', 'array', 'nullValue'])

    expect(result).toEqual({
      string: 'test',
      number: '(REDACTED)',
      boolean: '(REDACTED)',
      array: '(REDACTED)',
      object: { nested: 'value' },
      nullValue: '(REDACTED)',
      undefinedValue: undefined,
    })
  })

  it('should handle objects with symbol properties', () => {
    const sym = Symbol('test')
    const obj = {
      normalProp: 'normal',
      secretProp: 'secret',
      [sym]: 'symbol value',
    }

    const result = redact(obj, ['secretProp', 'symbol'])

    expect(result!.normalProp).toBe('normal')
    expect(result!.secretProp).toBe('(REDACTED)')
    expect(result![sym]).toBe('symbol value') // Symbol properties should remain
  })
})
