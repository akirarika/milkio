#!/usr/bin/env bun
import { create } from "../../../index.ts";
import { env } from "bun";

const PORT = 19000;

async function bootstrap() {
	const world: any = await create({
		port: PORT,
		develop: false,
		fetchEnv: (key: string) => env[key] ?? undefined,
	});

	Bun.serve({
		port: PORT,
		async fetch(request: Request) {
			return world.listener.fetch({
				request,
				env,
				envMode: env.VITE_MODE ?? "test",
			});
		},
	});

	console.log(`[milkio-prod] listening on :${PORT}`);
}

void bootstrap();
