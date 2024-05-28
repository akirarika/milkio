import { createClient } from "client";

export const client = createClient({
	baseUrl: "http://localhost:9000",
});

console.log(client);