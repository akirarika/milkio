import { createMilkioApp } from "milkio";
import { httpIOConsoleLog } from "./src/middlewares/http-io-console-log";

export const milkio = createMilkioApp({
	bootstraps: () => [],
	middlewares: () => [httpIOConsoleLog()],
});
