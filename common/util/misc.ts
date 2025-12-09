import fs, { promises as fsp } from 'fs'
import path from 'path'

/**
 *
 * @param array
 * @param callback
 */
export async function asyncForEach<T>(
  array: T[],
  callback: (
    elem: T,
    index: number,
    array: T[],
    breakFn?: () => void,
  ) => void | Promise<void>,
): Promise<void> {
  let cancelLoop = false
  const breakFn = () => {
    cancelLoop = true
  }
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array, breakFn)
    if (cancelLoop) break
  }
}

/**
 *
 * @param ms
 * @returns a promise that resolves after the amount of time specified in param 'ms'
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 *
 * @param min
 * @param max
 * @returns a promise that resolves after a random amount of time between min and max
 */
export function sleepRandom(min: number, max: number): Promise<void> {
  const randMs = (Math.random() * (max - min) + min) * 1000
  return sleep(randMs)
}

/**
 *
 * @param arr
 * @param chunkSize
 * @returns an array of arrays in length of param 'chunkSize'
 */
export function sliceIntoChunks(arr: any[], chunkSize: number): any[] {
  const res: any = []
  for (let i = 0; i < arr.length; i += chunkSize) {
    const chunk = arr.slice(i, i + chunkSize)
    res.push(chunk as never)
  }
  return res
}

/**
 *
 * @param param0
 * @param parseObjectFn
 */
export function iterateObject(
  { obj, tree = '' }: { obj: any; tree?: string },
  parseObjectFn: (obj: any, prop: string | number, tree: string) => void,
): void {
  for (const prop in obj) {
    parseObjectFn(obj, prop, tree)
    if (typeof obj[prop] === 'object') {
      iterateObject(
        { obj: obj[prop], tree: tree + prop + '+++' },
        parseObjectFn,
      )
    }
  }
}

/**
 *
 * @param str
 * @returns true/false for if this is a json-valid string
 */
export function isJsonString(str: string): boolean {
  try {
    JSON.parse(str)
  } catch (e) {
    return false
  }
  return true
}

/**
 *
 * @param dir
 * @param extn
 * @param files
 * @param result
 * @param regex
 * @returns a list of all files in a particular filesystem dir with a certain
 * file extension
 */
export const getAllFiles = async (
  dir: fs.PathLike,
  extn: string,
  files?: string[],
  result?: string[],
  regex?: RegExp,
): Promise<string[]> => {
  files = files || (await fsp.readdir(dir))
  result = result || []
  regex = regex || new RegExp(`\\${extn}$`)

  for (let i = 0; i < files.length; i++) {
    const file = path.join(dir as string, files[i])
    let isDir = false
    try {
      isDir = (await fsp.stat(file)).isDirectory()
    } catch (e) {
      continue
    }
    if (isDir) {
      try {
        result = await getAllFiles(
          file,
          extn,
          await fsp.readdir(file),
          result,
          regex,
        )
      } catch (error) {
        continue
      }
    } else {
      if (regex.test(file.toLowerCase())) {
        result.push(file)
      }
    }
  }
  return result
}
