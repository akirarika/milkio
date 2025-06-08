import type { $context, ContextHttp, Results, Logger, $meta } from "../index.ts";

export interface $events {
  "milkio:httpRequest": { executeId: string; path: string; logger: Logger; http: ContextHttp<Record<string, any>> };
  "milkio:httpResponse": { executeId: string; path: string; logger: Logger; http: ContextHttp<Record<string, any>>; context: $context };
  "milkio:httpNotFound": { executeId: string; path: string; logger: Logger; http: ContextHttp<Record<string, any>> };
  "milkio:executeBefore": { executeId: string; path: string; logger: Logger; meta: $meta; context: $context };
  "milkio:executeAfter": { executeId: string; path: string; logger: Logger; meta: $meta; context: $context; results: Results<any> };
}

export function __initEventManager() {
  const handlers = new Map<(event: any) => void, string>();
  const indexed = new Map<string, Set<(event: any) => void>>();

  const eventManager = {
    on: <Key extends keyof $events, Handler extends (event: $events[Key]) => void>(key: Key, handler: Handler) => {
      handlers.set(handler, key as string);
      if (indexed.has(key as string) === false) {
        indexed.set(key as string, new Set());
      }
      const set = indexed.get(key as string)!;
      set.add(handler);
      handlers.set(handler, key as string);

      return () => {
        handlers.delete(handler);
        set.delete(handler);
      };
    },
    off: <Key extends keyof $events, Handler extends (event: $events[Key]) => void>(key: Key, handler: Handler) => {
      const set = indexed.get(key as string);
      if (!set) return;
      handlers.delete(handler);
      set.delete(handler);
    },
    emit: async <Key extends keyof $events, Value extends $events[Key]>(key: Key, value: Value): Promise<void> => {
      const h = indexed.get(key as string);
      if (h) {
        for (const handler of h) {
          await handler(value);
        }
      }
    },
  };

  return eventManager;
}
