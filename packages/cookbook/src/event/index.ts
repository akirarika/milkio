export type CookbookEvents = {
  exit: undefined
}


const handlers = new Map<(event: any) => void, string>();
const indexed = new Map<string, Set<(event: any) => void>>();

export const eventManager = {
  on: <Key extends keyof CookbookEvents, Handler extends (event: CookbookEvents[Key]) => void>(key: Key, handler: Handler) => {
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
  off: <Key extends keyof CookbookEvents, Handler extends (event: CookbookEvents[Key]) => void>(key: Key, handler: Handler) => {
    const set = indexed.get(key as string);
    if (!set) return;
    handlers.delete(handler);
    set.delete(handler);
  },
  emit: async <Key extends keyof CookbookEvents, Value extends CookbookEvents[Key]>(key: Key, value: Value): Promise<void> => {
    const h = indexed.get(key as string);
    if (h) {
      for (const handler of h) {
        await handler(value);
      }
    }
  },
};