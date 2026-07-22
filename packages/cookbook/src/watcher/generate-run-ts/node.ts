import { join } from "node:path";
import type { CookbookOptions } from "../../utils/cookbook-dto-types.ts";

export async function nodeHandler(project: CookbookOptions["projects"]["key"], milkioDirPath: string) {
    await Bun.write(
        join(milkioDirPath, "run.ts"),
        `#!/usr/bin/env node
// @ts-nocheck
import * as http from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { create } from "../index.ts";
import { env } from "node:process";

async function bootstrap() {
  const world = await create({
    port: ${project.port},
    develop: Boolean(env.COOKBOOK_BASE_URL),
    fetchEnv: (key: string) => env[key] ?? undefined,
  });

  const server = http.createServer((req: IncomingMessage, res: ServerResponse) => {
    // Accumulate every chunk unconditionally: Node emits ~64KB per "data"
    // event, and any smarter buffering scheme here previously dropped the
    // third chunk of large request bodies (>128KB), corrupting JSON params.
    const bodyChunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => {
      bodyChunks.push(chunk);
    });
    req.on("end", () => {
      const method = req.method ?? "GET";
      const body: Uint8Array | null = bodyChunks.length > 0 ? Buffer.concat(bodyChunks) : null;
      const bodyText = body ? Buffer.from(body).toString("utf-8") : "";

      // Build full URL for standard Request
      const reqUrl = req.url ?? "/";
      const protocol = (req as any).encrypted ? "https" : "http";
      const host = req.headers.host ?? "localhost";
      const fullUrl = \`\${protocol}://\${host}\${reqUrl}\`;

      // Build standard Headers from Node.js incoming headers
      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (value === undefined) continue;
        if (Array.isArray(value)) {
          for (const v of value) headers.append(key, v);
        } else {
          headers.set(key, value);
        }
      }

      // Create AbortController for stream requests
      const isStream = req.headers.accept?.startsWith("text/event-stream");
      const signal = isStream ? (() => {
        const ac = new AbortController();
        res.on("close", () => { ac.abort(); });
        return ac.signal;
      })() : undefined;

      // Construct standard Request object
      const request = new Request(fullUrl, {
        method,
        headers,
        body: method !== "GET" && method !== "HEAD" ? body : undefined,
        signal,
      });

      // Attach pre-read data for Fast Path optimization
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
        envMode: env.VITE_MODE ?? "test",
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
            reader.read().then(({ done, value }) => {
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

  server.listen(world.listener.port);
}

void bootstrap();`,
    );
}
