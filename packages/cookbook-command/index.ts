import type { consola } from "consola";

export async function defineCookbookCommand<Handler extends CookbookCommandHandler>(handler: Handler): Promise<Handler> {
  return handler;
}

export type CookbookCommandHandler = (utils: {
  log: (typeof consola)["log"];
  info: (typeof consola)["info"];
  warn: (typeof consola)["warn"];
  error: (typeof consola)["error"];
  success: (typeof consola)["success"];
  debug: (typeof consola)["debug"];
  fatal: (typeof consola)["fatal"];
  trace: (typeof consola)["trace"];
  start: (typeof consola)["start"];
  box: (typeof consola)["box"];
  prompt: (typeof consola)["prompt"];
  getScriptPath: () => string;
  getWorkspacePath: () => string;
  getParams: () => {
    command: string;
    commands: Array<string>;
    options: Record<string, string | true>;
    raw: Array<string>;
  };
  inputBoolean: (options: { env: string; message: string; placeholder?: string }) => Promise<boolean>;
  inputString: (options: { env: string; message: string; placeholder?: string }) => Promise<string>;
  canUseAI: () => Promise<
    | false
    | {
        aiBaseUrl: string;
        aiApiKey: string;
        aiModel: string;
      }
  >;
  fetchEventSource: (
    input: string | URL | globalThis.Request,
    init?: RequestInit,
  ) => AsyncIterableIterator<{
    data: any;
    event?: string;
    id?: string;
  }>;
  openProgress: (message: string) => Promise<void>;
  closeProgress: (message: string) => Promise<void>;
  getCookbookToml: () => Promise<CookbookToml>;
}) => Promise<void>;

export interface CookbookToml {
  projects: Record<
    string,
    {
      type: "milkio" | "custom";
      port: number;
      start: Array<string>;
      build: Array<string>;
      name?: string;
      watch?: boolean;
      lazyRoutes?: boolean;
      typiaMode?: "generation" | "bundler";
      significant?: Array<string>;
      insignificant?: Array<string>;
      autoStart?: boolean;
      autoStartDelay?: number;
      connectTestUrl?: string;
    }
  >;
  general: {
    start: string;
    packageManager: string;
    cookbookPort: number;
  };
  config: {
    [key: string]: string | number | boolean;
  };
}
