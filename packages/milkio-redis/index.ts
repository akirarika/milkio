import type { RedisClientOptions } from "redis";

export async function createRedis<Options extends RedisClientOptions>(options: Options) {
  const NodeRedis = await import("redis");
  const redis = await NodeRedis.default.createClient(options).connect();

  const milkioRedis = {
    raw: redis,
    useCache: <T>(key: string, defaultValue: T | undefined = undefined) => ({
      set: async (value: T, expireMs: number): Promise<T> => {
        await redis.PSETEX(key, expireMs, JSON.stringify(value));
        return value;
      },
      get: async (): Promise<undefined | T> => {
        const result = await redis.GET(key);
        if (result === null) return defaultValue;
        return reviveJSONParse(JSON.parse(result));
      },
      pull: async () => {
        const resultRaw = await redis.MULTI().GET(key).DEL(key).EXEC();
        const result = resultRaw[0];
        if (result === null) return defaultValue;
        return reviveJSONParse(JSON.parse(result as string));
      },
      has: async (): Promise<boolean> => {
        const result = await redis.GET(key);
        return result !== null;
      },
      del: async () => {
        await redis.DEL(key);
      },
    }),
    useCount: (key: string) => ({
      get: async (): Promise<number> => {
        const result = await redis.GET(key);
        return result ? Number(result) : 0;
      },
      add: async (amount: number, expireMs?: number): Promise<number> => {
        if (!expireMs) {
          const result = await redis.INCRBY(key, amount);
          return result;
        } else {
          const result = await redis.MULTI().INCRBY(key, amount).PEXPIRE(key, expireMs).EXEC();
          return Number(result[0]);
        }
      },
      sub: async (key: string, amount: number): Promise<number> => {
        const result = await redis.DECRBY(key, amount);
        return result;
      },
    }),
    useResultCache: async <Handler extends () => unknown | Promise<unknown>>(key: string, expireMs: number, handler: Handler, options?: { realExpireMs?: number; lockInterval?: number }): Promise<Awaited<ReturnType<Handler>>> => {
      const resultRaw = await redis.get(key);
      if (resultRaw) {
        const result: { T: number; R: any } = reviveJSONParse(JSON.parse(resultRaw));
        if (result.T > new Date().getTime()) return result.R;
        const lock = await redis.GET(`${key}:lock`);
        if (lock === "1") return result.R;
        await redis.PSETEX(`${key}:lock`, options?.lockInterval ?? 6000, "1");
      }
      const result = { R: (await handler()) as Awaited<ReturnType<Handler>>, T: new Date().getTime() + expireMs };
      await redis.PSETEX(key, expireMs + (options?.realExpireMs ?? expireMs + Math.floor(expireMs * Math.random())) + (options?.lockInterval ?? 6000), JSON.stringify(result));

      return result.R;
    },
    useClockIn: (key: string, cleanDate: Date) => ({
      clockIn: async (offset: number): Promise<void> => {
        await redis.MULTI().SETBIT(key, offset, 1).PEXPIREAT(key, cleanDate.getTime()).EXEC();
      },
      check: async (offset: number): Promise<boolean> => {
        const result = await redis.GETBIT(key, offset);
        return result === 1;
      },
      firstClockIn: async (): Promise<number> => {
        const result = await redis.BITPOS(key, 1);
        return result;
      },
      lastClockIn: async (): Promise<number> => {
        const result = await redis.BITPOS(key, 1, -1);
        return result;
      },
      toArray: async (length: number): Promise<boolean[]> => {
        const resultRaw = await redis.BITFIELD(key, [
          {
            operation: "GET",
            encoding: `u${length}`,
            offset: "#0",
          },
        ]);
        const result = Number.parseInt(`${resultRaw}`).toString(2).split("");
        const fill = [];
        for (let i = 0; i < length - result.length; i++) fill.push("0");
        return [...fill, ...result].map((v) => v === "1");
      },
      count: async (): Promise<number> => {
        const result = await redis.BITCOUNT(key);
        return result;
      },
      clean: async (): Promise<void> => {
        await redis.DEL(key);
      },
    }),
  };

  return milkioRedis;
}

function reviveJSONParse<T>(json: T): T {
  const isoDatePattern = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?)(Z|[+-]\d{2}:?\d{2})?$/;

  if (json instanceof Date) return json;
  if (Array.isArray(json)) {
    return json.map((item) => reviveJSONParse(item)) as any;
  }
  if (typeof json === "object" && json !== null) {
    return Object.entries(json).reduce((acc, [key, value]) => {
      acc[key as keyof T] = reviveJSONParse(value);
      return acc;
    }, {} as T);
  }
  if (typeof json === "string") {
    const match = json.match(isoDatePattern);
    if (match) {
      const normalizedDateString = match[2] ? `${match[1]}${match[2].replace(":", "")}` : `${match[1]}Z`;
      return new Date(normalizedDateString) as any;
    }
  }
  return json;
}

export type Redis = Awaited<ReturnType<typeof createRedis>>;
