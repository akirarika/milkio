import mitt from "mitt";

export type Emit =
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

export const emitter = mitt<{ data: Emit }>();
