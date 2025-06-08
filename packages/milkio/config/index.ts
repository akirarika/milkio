export function config<ConfigT extends Config>(config: ConfigT): ConfigT {
  return config;
}

export type Config = (mode: string) => Promise<Record<string, unknown>> | Record<string, unknown>;

export interface ConfigEnvironments<T extends Config> {
  [key: string]: (env: Record<string, string>) => Partial<Awaited<ReturnType<T>>> | Promise<Partial<Awaited<ReturnType<T>>>>;
}

export function envToString(value: string | number | undefined, defaultValue: string) {
  if (value === undefined) return defaultValue;

  return `${value}`;
}

export function envToNumber(value: string | undefined, defaultValue: number) {
  if (value === undefined) return defaultValue;

  return Number.parseInt(value, 10);
}

export function envToBoolean(value: string | number | undefined, defaultValue: boolean) {
  if (value === "true") return true;

  if (value === "false") return false;

  if (value === "") return false;

  if (undefined === value) return defaultValue;

  return Boolean(value);
}
