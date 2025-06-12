import type { RedisClientOptions } from "redis";

export type MilkioRedisCacheOptions<T> = {
  defaultValue: T | undefined;
  expireMs: number;
  fetch: () => T | undefined | Promise<T | undefined>;
  options?: {
    realExpireMs?: number;
    lockInterval?: number;
    notFoundExpireMs?: number;
  };
};

type MilkioRedisCache<T> = {
  set: (value: T, expireMs: number) => Promise<T>;
  get: () => Promise<T | undefined>;
  pull: () => Promise<T | undefined>;
  has: () => Promise<boolean>;
  del: () => Promise<void>;
  fetch: () => Promise<T | undefined>;
};

export async function createRedis<Options extends RedisClientOptions>(options: Options) {
  const NodeRedis = await import("redis");
  const redis = await NodeRedis.default.createClient(options).connect();

  const milkioRedis = {
    redis,
    useCache: <T>(key: string, options?: MilkioRedisCacheOptions<T>): MilkioRedisCache<T> =>
      ({
        set: async (value: T, expireMs: number): Promise<T> => {
          if (options?.fetch) throw new Error("options.fetch is defined");
          await redis.PSETEX(key, expireMs, JSON.stringify(value));
          return value;
        },
        get: async (): Promise<T | undefined> => {
          if (options?.fetch) throw new Error("options.fetch is defined");
          const result = await redis.GET(key);
          if (result === null) return options?.defaultValue;
          return reviveJSONParse(JSON.parse(result));
        },
        pull: async () => {
          const resultRaw = await redis.MULTI().GET(key).DEL(key).EXEC();
          const result = resultRaw[0];
          if (result === null) return options?.defaultValue;
          return reviveJSONParse(JSON.parse(result as string));
        },
        has: async (): Promise<boolean> => {
          const result = await redis.GET(key);
          return result !== null;
        },
        del: async () => {
          await redis.DEL(key);
        },
        fetch: async (): Promise<T | undefined> => {
          if (!options?.fetch) throw new Error("options.fetch is not defined");

          const lockInterval = options?.options?.lockInterval ?? 8192;
          const realExpireMs = options?.options?.realExpireMs ?? Math.floor(options.expireMs * (Math.random() + 0.5)) + 8192;

          const notFoundExpireMs = options?.options?.notFoundExpireMs ?? Math.min(options.expireMs, 16384);

          const resultRaw = await redis.get(key);
          const result = resultRaw ? (reviveJSONParse(JSON.parse(resultRaw)) as { T: number; R: T }) : undefined;

          const now = Date.now();
          if (result && result.T > now) {
            return result.R;
          }

          const lockKey = `${key}:lock`;
          const lockSet = await redis.set(lockKey, "1", { PX: lockInterval, NX: true });
          const gotLock = lockSet === "OK";

          if (gotLock) {
            try {
              const recheckRaw = await redis.get(key);
              const recheck = recheckRaw ? (reviveJSONParse(JSON.parse(recheckRaw)) as { T: number; R: T }) : undefined;

              if (recheck && recheck.T > now) {
                return recheck.R;
              }

              const data = await options.fetch();

              const effectiveExpireMs = data !== undefined ? options.expireMs + realExpireMs : notFoundExpireMs;

              const cacheValue = {
                T: now + (data !== undefined ? options.expireMs : notFoundExpireMs),
                R: data,
              };

              await redis.PSETEX(key, effectiveExpireMs, JSON.stringify(cacheValue));

              return data;
            } finally {
              await redis.del(lockKey);
            }
          } else {
            return result ? result.R : options.defaultValue;
          }
        },
      }) as any,
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
      sub: async (amount: number): Promise<number> => {
        const result = await redis.DECRBY(key, amount);
        return result;
      },
    }),
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
