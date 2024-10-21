import { relative } from "path";
import { argv, cwd } from "node:process";
// @ts-ignore
import { camel, hump, hyphen } from "@poech/camel-hump-under";

export type CreateTemplateTools = {
  name: () => string;
  directory: () => string;
  route: () => string;
  src: () => string;
  camel: (str: string) => string;
  hump: (str: string) => string;
  hyphen: (str: string) => string;
};

export type CreateTemplateFn = (tools: CreateTemplateTools) =>
  | {
      path: string;
      content: string;
    }
  | Promise<{
      path: string;
      content: string;
    }>;

export async function createTemplate(fn: CreateTemplateFn) {
  const tools = {
    name: () => argv[2],
    directory: () => argv[3],
    route: () => {
      const path = relative(cwd().replaceAll("\\", "/"), argv[3]).split("/").slice(3).join("/");
      if (path.length > 0) return `/${path}`;
      return path;
    },
    src: () => {
      const patharr = argv[3].split("/");
      const i = patharr.length - patharr.findIndex((str: string) => str.startsWith("src")) - 1;
      let path = "";
      for (let j = 0; j < i; j++) {
        path += "../";
      }
      return path;
    },
    camel: (str: string) => camel(str).replaceAll("-", "").replaceAll("_", ""),
    hump: (str: string) => hump(str).replaceAll("-", "").replaceAll("_", ""),
    hyphen: (str: string) => hyphen(str).replaceAll("_", ""),
  };
  const file = await fn(tools);
  await Bun.write(file.path, file.content);
}
