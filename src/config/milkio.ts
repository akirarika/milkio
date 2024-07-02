import { env } from "node:process"
import { defineConfig, envToBoolean, envToNumber, envToString } from "milkio"

export const configMilkio = defineConfig(({ config }) => {
  return config({
    debug: envToBoolean(env.MILKIO_DEBUG, false),

    // api test
    apiTestPath: envToString(env.MILKIO_API_TEST_PATH, ""),

    // http server
    ignorePathLevel: envToNumber(env.MILKIO_IGNORE_PATH_LEVEL, 0),
    corsAllowMethods: envToString(env.MILKIO_CORS_ALLOW_METHODS, "*"),
    corsAllowHeaders: envToString(env.MILKIO_CORS_ALLOW_HEADERS, "*"),
    corsAllowOrigin: envToString(env.MILKIO_CORS_ALLOW_ORIGIN, "*")
  }).environment(() => env.NODE_ENV === "development", {
    debug: false
  }).environment(() => env.NODE_ENV === "production", {
    debug: true
  }).done()
});
