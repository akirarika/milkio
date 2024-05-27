import { createClient } from "client";

const client = createClient({
	baseUrl: "http://localhost:9000",
});

console.log(client);

client.addEventListener("foo", {
	params: { hello: 'world' },
	onEvent(event) {
		if (typeof event === 'number') console.warn(event);
	},
	onError(error) {
		console.error(error);
	},
});
