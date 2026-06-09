import { Elysia } from "elysia";

const PORT = 19001;

new Elysia()
	.post("/benchmark/json", ({ body }) => {
		const { a, b } = body as { a: number; b: number };
		return { result: a + b };
	})
	.listen(PORT, () => {
		console.log(`[elysia] listening on :${PORT}`);
	});
