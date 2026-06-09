#!/usr/bin/env bun
import * as http from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { create } from "../../../index.ts";
import { env } from "node:process";

const PORT = 19000;

async function bootstrap() {
	const world: any = await create({
		port: PORT,
		develop: false,
		fetchEnv: (key: string) => env[key] ?? undefined,
	});

	const server = http.createServer((req: IncomingMessage, res: ServerResponse) => {
		let bodyBuffer: Buffer | null = null;
		let bodyChunks: Buffer[] | null = null;
		req.on("data", (chunk: Buffer) => {
			if (bodyBuffer === null) {
				bodyBuffer = chunk;
			} else {
				if (bodyChunks === null) {
					bodyChunks = [bodyBuffer, chunk];
					bodyBuffer = null;
				} else {
					bodyChunks.push(chunk);
				}
			}
		});
		req.on("end", () => {
			const method = req.method ?? "GET";
			const body = bodyChunks ? Buffer.concat(bodyChunks) : bodyBuffer;
			const bodyText = body ? body.toString("utf-8") : "";

			const reqUrl = req.url ?? "/";
			const protocol = (req as any).encrypted ? "https" : "http";
			const host = req.headers.host ?? "localhost";
			const fullUrl = `${protocol}://${host}${reqUrl}`;

			const headers = new Headers();
			for (const [key, value] of Object.entries(req.headers)) {
				if (value === undefined) continue;
				if (Array.isArray(value)) {
					for (const v of value) headers.append(key, v);
				} else {
					headers.set(key, value);
				}
			}

			const isStream = req.headers.accept?.startsWith("text/event-stream");
			const signal = isStream ? (() => {
				const ac = new AbortController();
				res.on("close", () => { ac.abort(); });
				return ac.signal;
			})() : undefined;

			const request = new Request(fullUrl, {
				method,
				headers,
				body: method !== "GET" && method !== "HEAD" ? body : undefined,
				signal,
			});

			const qIndex = reqUrl.indexOf("?");
			const pathname = qIndex >= 0 ? reqUrl.substring(0, qIndex) : reqUrl;
			(request as any).__bodyText = bodyText;
			(request as any).__pathname = pathname;
			(request as any).__pathArray = pathname.length > 1 ? pathname.substring(1).split("/") : [];
			(request as any).__origin = req.headers.origin ?? null;
			(request as any).__isAction = !isStream;

			world.listener.fetch({
				request,
				env,
				envMode: env.COOKBOOK_MODE ?? "test",
				rawResponse: true,
			}).then((response: any) => {
				if (response.__rawResponse) {
					res.writeHead(response.status, response.headers);
					const resBody = response.body;
					if (typeof resBody === 'string') {
						res.end(Buffer.from(resBody, 'utf-8'));
					} else if (resBody instanceof Uint8Array || Buffer.isBuffer(resBody)) {
						res.end(resBody);
					} else if (resBody instanceof ArrayBuffer) {
						res.end(Buffer.from(resBody));
					} else if (resBody instanceof Blob) {
						resBody.arrayBuffer().then((ab: ArrayBuffer) => {
							res.end(Buffer.from(ab));
						});
						return;
					} else if (resBody != null) {
						res.end(resBody);
					} else {
						res.end();
					}
					return;
				}
				const resHeaders: Record<string, string | string[]> = {};
				for (const [key, value] of response.headers) {
					if (key in resHeaders) {
						const existing = resHeaders[key];
						if (Array.isArray(existing)) existing.push(value);
						else resHeaders[key] = [existing, value];
					} else {
						resHeaders[key] = value;
					}
				}
				res.writeHead(response.status, resHeaders);
				if (response.body != null && req.method !== "HEAD") {
					const reader = response.body.getReader();
					const pump = (): Promise<void> =>
						reader.read().then(({ done, value }: { done: boolean; value?: Uint8Array }) => {
							if (done) { res.end(); return; }
							res.write(value);
							return pump();
						});
					pump();
				} else {
					res.end();
				}
			}).catch((error: any) => {
				console.error(error);
				if (!res.headersSent) res.writeHead(500);
				res.end("Internal Server Error");
			});
		});
	});

	server.listen(PORT);
	console.log(`[milkio-prod] listening on :${PORT}`);
}

void bootstrap();
