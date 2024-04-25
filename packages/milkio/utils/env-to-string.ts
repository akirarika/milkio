export function envToString(value: string | number | undefined, defaultValue: string) {
  if (value === undefined) return defaultValue

  return `${value}`
}
