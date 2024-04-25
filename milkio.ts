import { createMilkioApp } from "milkio"
import { httpIOConsoleLog } from "./src/middlewares/http-io-console-log"
import { helloWorld } from "./src/bootstraps/hello-world"

export const milkio = createMilkioApp({
  bootstraps: () => [helloWorld()],
  middlewares: () => [httpIOConsoleLog()]
})