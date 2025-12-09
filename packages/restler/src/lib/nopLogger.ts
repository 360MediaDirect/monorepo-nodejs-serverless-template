import { Logger } from '../types'

const nopLogger: Logger = {
  child() {
    return this
  },
  error: () => {},
  warn: () => {},
  info: () => {}
}

export default nopLogger
