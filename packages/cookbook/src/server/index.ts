import { consola } from "consola";
import { join } from "node:path";
import { getActionOptions } from "../typia/generated";
import type { BunFile } from "bun";
import { actionHandler, type MilkioActionResultFail } from "../actions";
import { TSON } from "@southern-aurora/tson";
import type { CookbookOptions } from "..";
import { emitter } from "../emitter";

export const initServer = async (options: CookbookOptions) => {
  Bun.serve({
    port: options.general.cookbookPort,
    async fetch(request) {
      const url = new URL(request.url);
      switch (url.pathname) {
        case "/$action": {
          try {
            const options = getActionOptions(await request.text());
            const result = await actionHandler(options);
            return new Response(TSON.stringify(result));
          } catch (error) {
            consola.error(error);
            return new Response(TSON.stringify({ success: false } satisfies MilkioActionResultFail), { headers: { "Content-Type": "application/json", "Cache-Control": "no-cache" }, status: 500 });
          }
        }
        case "/$subscribe": {
          let control: ReadableStreamDirectController;
          let messages: Array<string> = [];
          const handler = (data: any) => {
            messages.push(`data:${TSON.stringify(data)}\n\n`);
          };
          emitter.on("data", handler);
          let closed = false;
          const stream = new ReadableStream({
            type: "direct",
            async pull(controller: ReadableStreamDirectController) {
              control = controller;
              while (!closed) {
                const message = messages.shift();
                if (!message) await Bun.sleep(20);
                else controller.write(message);
              }
            },
            cancel() {
              emitter.off("data", handler);
              control.close();
              closed = true;
            },
          });
          return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
        }
        default: {
          const assets = join(import.meta.dirname, "website");
          let response = { body: "" as any, headers: { "Cache-Control": "no-store" } as Record<string, string> };
          let file: BunFile | string = Bun.file(join(assets, url.pathname));

          if (await file.exists()) {
            response.headers["Content-Type"] = file.type;
          } else {
            file = Bun.file(join(assets, url.pathname, "index.html"));
            if (!(await file.exists())) file = "404 Not Found ~ UwU";
          }

          return new Response(file, response);
        }
      }
    },
  });
};
