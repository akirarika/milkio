import { env } from "node:process";
import { defineMilkio } from "milkio-core";

const { port, httpHandler } = await defineMilkio({
  port: { app: 9000, develop: env.NODE_ENV ? "disabled" : 9001 },
  argv: process.argv,
});

Bun.serve({
  port: port,
  fetch(request) {
    return httpHandler({ request });
  },
});
