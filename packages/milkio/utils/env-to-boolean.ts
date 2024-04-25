export function envToBoolean(value: string | number | undefined, defaultValue: boolean) {
  if (value === "true") return true

  if (value === "false") return false

  if (value === "") return false

  if (undefined === value) return defaultValue

  return Boolean(value)
}
