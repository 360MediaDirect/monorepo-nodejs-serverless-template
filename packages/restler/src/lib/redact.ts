/* eslint-disable @typescript-eslint/no-extra-semi */
/**
 * Produces a redacted copy of the given object, redacting only the requested
 * fields if they exist.
 * @param obj An object with fields that may need to be redacted
 * @param fields An array of field names to redact if they appear in obj
 * @returns A shallow copy of obj with any fields matching the ones in the given
 * array replaced with the string "(REDACTED)". If obj is falsey, the same
 * falsey value will be returned.
 */
export function redact<T extends Record<string, any>>(
  obj: T | null | undefined,
  fields: string[]
): T | null | undefined {
  if (!obj) return obj
  const redacted = { ...obj }
  fields.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(obj, field)) {
      ;(redacted as any)[field] = '(REDACTED)'
    }
  })
  return redacted
}
