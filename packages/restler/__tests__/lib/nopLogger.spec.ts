import nopLogger from '../../src/lib/nopLogger'
import { Logger } from '../../src/types'

describe('nopLogger', () => {
  it('should implement the Logger interface', () => {
    expect(nopLogger).toHaveProperty('child')
    expect(nopLogger).toHaveProperty('error')
    expect(nopLogger).toHaveProperty('warn')
    expect(nopLogger).toHaveProperty('info')
  })

  it('should have child method that returns itself', () => {
    const child = nopLogger.child()
    expect(child).toBe(nopLogger)
  })

  it('should have child method that returns itself with options', () => {
    const child = nopLogger.child({ key: 'value' })
    expect(child).toBe(nopLogger)
  })

  it('should have no-op logging methods', () => {
    // These should not throw and should return undefined
    expect(nopLogger.error('test')).toBeUndefined()
    expect(nopLogger.warn('test')).toBeUndefined()
    expect(nopLogger.info('test')).toBeUndefined()
  })

  it('should handle multiple arguments in log methods', () => {
    expect(() => {
      nopLogger.error('test', 'arg1', 'arg2')
      nopLogger.warn('test', { key: 'value' })
      nopLogger.info('test', 123, true)
    }).not.toThrow()
  })

  it('should be assignable to Logger type', () => {
    const logger: Logger = nopLogger
    expect(logger).toBeDefined()
    expect(typeof logger.child).toBe('function')
    expect(typeof logger.error).toBe('function')
    expect(typeof logger.warn).toBe('function')
    expect(typeof logger.info).toBe('function')
  })
})
