/**
 *
 * @param dec
 * @returns hex string
 */
export function dec2hex(dec: number): string {
  return dec.toString(16).padStart(2, '0')
}

/**
 *
 * @param dateStr
 * @returns formatted date string
 */
export function formatDateString(dateStr: string): string {
  if (!dateStr) return ''
  let returnStr = `${dateStr}`
  switch (dateStr.length) {
    case 6:
      returnStr = returnStr.substring(0, 4) + '-' + returnStr.substring(4)
      break
    case 8:
      returnStr = returnStr.substring(0, 6) + '-' + returnStr.substring(6)
      returnStr = returnStr.substring(0, 4) + '-' + returnStr.substring(4)
      break
  }

  return returnStr
}

/**
 *
 * @param obj
 * @returns obj
 */
export const getTrimmedData = (obj: any): any => {
  if (obj && typeof obj === 'object') {
    Object.keys(obj).map((key) => {
      if (typeof obj[key] === 'object') {
        getTrimmedData(obj[key])
      } else if (typeof obj[key] === 'string') {
        obj[key] = obj[key].trim()
      }
    })
  }
  return obj
}

/**
 *
 * @param str
 * @param replaceChar
 * @returns slug string
 */
export const slugify = (str: string, replaceChar = ''): string => {
  return str
    .replace(/\W/g, replaceChar)
    .replace(/[`~!@#$%^&*()_|+\-=?;:'",.<>\{\}\[\]\\\/]/gi, replaceChar)
    .replace(/--+/g, '-')
    .toLowerCase()
}
