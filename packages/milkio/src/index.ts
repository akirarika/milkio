import open from "open";
import { consola } from "consola";
import { join } from "node:path";
import { exit, cwd } from "node:process";
import { getOptions, getActionOptions } from "./typia/generated";
import type { BunFile } from "bun";
import { actionHandler, type MilkioActionResultFail } from "./actions";
import { TSON } from "@southern-aurora/tson";

export type MilkioOptions = {
  general: {
    developPort: number;
  };
};

export const execute = async () => {
  console.clear();
  const options: MilkioOptions = await getOptions(Bun.file(join(cwd(), "milkio.toml")));

  Bun.serve({
    port: options.general.developPort,
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
            return new Response(TSON.stringify({ success: false } satisfies MilkioActionResultFail));
          }
        }
        case "/$subscribe": {
          return new Response();
        }
        default: {
          const assets = join(import.meta.dirname, "website");
          let response = { body: "" as any, headers: { "Cache-Control": "no-store" } as Record<string, string> };
          let file: BunFile | string = Bun.file(join(assets, url.pathname));

          if (await file.exists()) {
            response.headers["Content-Type"] = file.type;
          } else {
            file = Bun.file(join(assets, url.pathname, "index.html"));
            if (!(await file.exists())) file = "UwU 404 Not Found";
          }

          return new Response(file, response);
        }
      }
    },
  });

  (async () => {
    while (true) {
      console.log("");
      consola.success(`Cookbook is ready!`);
      consola.info(`URL: http://localhost:${options.general.developPort}`);

      const selected = await consola.prompt("do something?", {
        type: "select",
        options: ["Open Cookbook", "Quit"],
        initial: "TypeScript",
      });
      if (selected === "Quit") {
        exit(0);
      }
      if (selected === "Open Cookbook") {
        await open(`http://localhost:${options.general.developPort}`);
      }
      console.clear();
    }
  })();
};
