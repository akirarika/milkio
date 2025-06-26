export type CookbookActionParams =
  | {
      type: "milkio@ping";
    }
  | {
      type: "milkio@logger";
      log: Array<any>;
    }
  | {
      type: "milkio@template";
      name: string;
      fsPath: string;
      template: string;
    }
  | {
      type: "project@list";
    }
  | {
      type: "project@log";
      key: string;
      firstId: number;
    }
  | {
      type: "project@stop";
      key: string;
    }
  | {
      type: "project@start";
      key: string;
    }
  | {
      type: "project@inspect";
      key: string;
    }
  | {
      type: "project@stop-inspect";
      key: string;
    };

export interface CookbookOptions {
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
      runtime?: "node" | "deno" | "bun";
      name?: string;
      lazyRoutes?: boolean;
      watcher?: Array<string>;
      autoStart?: boolean;
      autoStartDelay?: number;
      connectTestUrl?: string;
      drizzle?: Array<{
        mode: string;
        migrateDatabaseUrl: string;
        migrateMode: "generate" | "push" | "any";
        schemaDir?: string;
      }>;
    }
  >;
  general: {
    start: string;
    packageManager: string;
    cookbookPort: number;
    modes: Array<string>;
  };
  config: {
    [key: string]: string | number | boolean;
  };
  hash: string;
}

export type CookbookSubscribeEmits =
  | {
      type: "workers@stdout";
      key: string;
      chunk: string;
    }
  | {
      type: "workers@state";
      key: string;
      state: "running" | "stopped";
      code: number | null | "kill" | "running";
    }
  | {
      type: "watcher@change";
      event: "rename" | "change";
      path: string;
    }
  | {
      type: "milkio@logger";
      log: Array<any>;
    };
