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
    subCommand?: string;
  };
  inputBoolean: (options: { env: string; message: string; placeholder?: string }) => Promise<boolean>;
  inputString: (options: { env: string; message: string; placeholder?: string }) => Promise<string>;
  useAIConfig: () => Promise<
    | undefined
    | {
        aiBaseUrl: string;
        aiApiKey: string;
        aiModel: string;
        aiModelDeepResearch: string;
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
  selectProject: (options?: {
    withRoot?: boolean;
    projectUsed?: string;
    filter?: (project: CookbookToml["projects"][0] & { value: string }) => boolean | Promise<boolean>;
  }) => Promise<CookbookToml["projects"][0] & { value: any; path: string }>;
  getCookbookToml: () => Promise<CookbookToml>;
  gotoCommand: (command: Promise<{ default: (...args: any[]) => any }>) => Promise<void>;
  gotoDrizzleCommand: (command?: string, project?: string, mode?: string) => Promise<void>;
  toCamelCase: (str: string) => string;
  toPascalCase: (str: string) => string;
  toSnakeCase: (str: string) => string;
  toConstantCase: (str: string) => string;
}) => Promise<void>;

export interface CookbookToml {
  projects: Record<
    string,
    {
      type: "milkio" | "custom";
      port: number;
      start: string;
      build: string;
      meta: Partial<{
        inspect: boolean;
      }>;
      name?: string;
      lazyRoutes?: boolean;
      typiaMode?: "generation" | "bundler";
      watcher?: Array<string>;
      autoStart?: boolean;
      autoStartDelay?: number;
      connectTestUrl?: string;
      prismaMigrateMode?: "migrate-dev" | "push";
    }
  >;
  general: {
    start: string;
    modes: Array<string>;
    packageManager: string;
    cookbookPort: number;
  };
  config: {
    [key: string]: string | number | boolean;
  };
  hash: string;
}
