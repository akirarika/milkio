import { defineHttpHandler, envToNumber } from "milkio";
import { env } from "node:process";
import { milkio } from "./milkio";

async function serve() {
	const port = envToNumber(env.PORT, 9000);
	const httpHandler = defineHttpHandler(await milkio);
	// if you are using Bun
	Bun.serve({
		port: port,
		fetch(request) {
			return httpHandler({ request });
		},
	});
	// http server started
	console.log(`Server listening on http://localhost:${port}`);
}

serve();
