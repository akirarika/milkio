export const headerToPlainObject = (headers: Headers) => {
  if (headers.toJSON) return headers.toJSON()
  const plainHeaders: Record<string, string> = {}
  headers.forEach((value, key) => {
    plainHeaders[key] = value
  })
  return headers
}