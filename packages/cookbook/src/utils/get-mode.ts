import { env } from "bun";

export function getMode() {
  return env?.MODE ?? "development";
}
