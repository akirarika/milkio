// @ts-nocheck  standalone script, runs via `bun run` outside monorepo TS context
import Koa from "koa";
import Router from "@koa/router";
import { bodyParser } from "@koa/bodyparser";

const PORT = 19002;

const app = new Koa();
const router = new Router();

router.post("/benchmark/json", (ctx) => {
	const { a, b } = ctx.request.body as { a: number; b: number };
	ctx.body = { result: a + b };
});

app.use(bodyParser());
app.use(router.routes());
app.use(router.allowedMethods());

app.listen(PORT, () => {
	console.log(`[koa] listening on :${PORT}`);
});
