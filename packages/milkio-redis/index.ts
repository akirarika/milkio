export type MilkioRedisCacheOptions<T> = {
    defaultValue?: T | undefined;
    expireMs: number | null;
};

export type MilkioRedisFetchOptions<T> = {
    defaultValue?: T | undefined;
    expireMs: number | null;
    realExpireMs?: number | null;
    lockInterval?: number;
    refreshLockInterval?: number;
    notFoundExpireMs?: number | null;
    fetch: () => T | undefined | Promise<T | undefined>;
};

export type MilkioRedis<RedisT = any> = {
    redis: RedisT;
    useCache: <T>(key: string, options?: MilkioRedisCacheOptions<T>) => {
        set: (value: T, expireMs: number | null) => Promise<T>;
        get: () => Promise<T | undefined>;
        pull: () => Promise<T | undefined>;
        has: () => Promise<boolean>;
        del: () => Promise<void>;
    };
    useFetch: <T>(key: string, options: MilkioRedisFetchOptions<T>) => {
        has: () => Promise<boolean>;
        del: () => Promise<void>;
        fetch: () => Promise<T>;
        refresh: () => Promise<void>;
    };
    useCount: (key: string) => {
        get: () => Promise<number>;
        add: (amount: number, expireMs?: number | null) => Promise<number>;
        sub: (amount: number) => Promise<number>;
    };
    useClockIn: (key: string, cleanDate: Date) => {
        clockIn: (offset: number) => Promise<void>;
        check: (offset: number) => Promise<boolean>;
        firstClockIn: () => Promise<number>;
        lastClockIn: () => Promise<number>;
        toArray: (length: number) => Promise<boolean[]>;
        count: () => Promise<number>;
        clean: () => Promise<void>;
    };
};

export async function createRedis<RedisT extends { PSETEX: any; SET: any;[others: string | number | symbol]: any }>(redisClient: RedisT): Promise<MilkioRedis<RedisT>> {
    const redis = redisClient as any;

    const milkioRedis: any = {
        redis,
        useCache: <T>(key: string, options?: MilkioRedisCacheOptions<T>) => ({
            set: async (value: T, expireMs: number | null): Promise<T> => {
                if (expireMs === null) {
                    // 永久保存
                    await redis.SET(key, JSON.stringify(value));
                } else {
                    await redis.PSETEX(key, expireMs, JSON.stringify(value));
                }
                return value;
            },
            get: async (): Promise<T | undefined> => {
                const result = await redis.GET(key);
                if (result === null) return options?.defaultValue;
                return reviveJSONParse(JSON.parse(result as any as string));
            },
            pull: async () => {
                const resultRaw = await redis.MULTI().GET(key).DEL(key).EXEC();
                const result = resultRaw[0];
                if (result === null) return options?.defaultValue;
                return reviveJSONParse(JSON.parse(result as any as string));
            },
            has: async (): Promise<boolean> => {
                const result = await redis.GET(key);
                return result !== null;
            },
            del: async () => {
                await redis.DEL(key);
            },
        }),

        useFetch: <Options extends MilkioRedisFetchOptions<any>>(key: string, options: Options) => {
            if (options.expireMs !== null && (typeof options.expireMs !== "number" || options.expireMs <= 0)) {
                throw new Error("expireMs must be a positive number or null");
            }

            if (options.lockInterval !== undefined && (typeof options.lockInterval !== "number" || options.lockInterval <= 0)) {
                throw new Error("lockInterval must be a positive number if provided");
            }

            if (options.realExpireMs !== undefined && options.realExpireMs !== null && (typeof options.realExpireMs !== "number" || options.realExpireMs <= 0)) {
                throw new Error("realExpireMs must be a positive number or null if provided");
            }

            if (options.notFoundExpireMs !== undefined && options.notFoundExpireMs !== null && (typeof options.notFoundExpireMs !== "number" || options.notFoundExpireMs <= 0)) {
                throw new Error("notFoundExpireMs must be a positive number or null if provided");
            }

            if (options.refreshLockInterval !== undefined) {
                if (typeof options.refreshLockInterval !== "number" || options.refreshLockInterval <= 0) {
                    throw new Error("refreshLockInterval must be a positive number if provided");
                }

                const lockInterval = options.lockInterval ?? 8192;
                if (options.refreshLockInterval <= lockInterval) {
                    throw new Error("refreshLockInterval must be greater than lockInterval");
                }
            }

            if (typeof options.fetch !== "function") {
                throw new Error("fetch must be a function");
            }

            return {
                has: async (): Promise<boolean> => {
                    const result = await redis.GET(key);
                    return result !== null;
                },
                del: async () => {
                    await redis.DEL(key);
                },
                fetch: async (): Promise<Awaited<ReturnType<Options["fetch"]>>> => {
                    const lockInterval = options.lockInterval ?? 8192;

                    // 处理永久保存的情况
                    let realExpireMs: number | null = options.realExpireMs ?? null;
                    if (options.expireMs !== null) {
                        realExpireMs = options.realExpireMs ?? Math.floor(options.expireMs * (Math.random() + 0.5)) + 8192;
                    }

                    const notFoundExpireMs = options.notFoundExpireMs ?? (options.expireMs !== null ? Math.min(options.expireMs, 16384) : 86400000); // 默认1天

                    const resultRaw = await redis.GET(key);
                    const result = resultRaw ? (reviveJSONParse(JSON.parse(resultRaw as string)) as { T: number; R: Awaited<ReturnType<Options["fetch"]>> }) : undefined;

                    const now = Date.now();
                    if (result && result.T > now) {
                        return result.R;
                    }

                    const refreshLockKey = `${key}:refresh-lock`;
                    if (await redis.EXISTS(refreshLockKey)) {
                        return result ? result.R : options?.defaultValue;
                    }

                    const lockKey = `${key}:lock`;
                    const lockSet = await redis.SET(lockKey, "1", { PX: lockInterval, NX: true });
                    const gotLock = lockSet === "OK";

                    if (!gotLock) return result ? result.R : options.defaultValue;

                    const recheckRaw = await redis.GET(key);
                    const recheck = recheckRaw ? (reviveJSONParse(JSON.parse(recheckRaw as string)) as { T: number; R: Awaited<ReturnType<Options["fetch"]>> }) : undefined;

                    if (recheck && recheck.T > now) {
                        return recheck.R;
                    }

                    let data: Awaited<ReturnType<Options["fetch"]>>;
                    try {
                        data = await options.fetch();
                    } catch (error) {
                        await redis.DEL(lockKey);
                        throw error;
                    }

                    // 计算过期时间
                    let effectiveExpireMs: number | null = null;
                    if (data !== undefined) {
                        if (options.expireMs !== null) {
                            effectiveExpireMs = options.expireMs + (realExpireMs ?? 0);
                        }
                        // 如果 expireMs 为 null，effectiveExpireMs 保持 null（永久保存）
                    } else {
                        effectiveExpireMs = notFoundExpireMs;
                    }

                    const cacheValue = {
                        T: now + (data !== undefined ? (options.expireMs ?? Number.MAX_SAFE_INTEGER) : notFoundExpireMs),
                        R: data,
                    };

                    const refreshLockExists = await redis.EXISTS(refreshLockKey);
                    if (refreshLockExists) {
                        await redis.DEL(lockKey);
                        return data;
                    }

                    if (effectiveExpireMs === null) {
                        // 永久保存
                        await redis.MULTI().SET(key, JSON.stringify(cacheValue)).DEL(lockKey).EXEC();
                    } else {
                        await redis.MULTI().PSETEX(key, effectiveExpireMs, JSON.stringify(cacheValue)).DEL(lockKey).EXEC();
                    }

                    return data;
                },
                refresh: async (): Promise<void> => {
                    const refreshLockKey = `${key}:refresh-lock`;
                    const refreshLockInterval = options.refreshLockInterval ?? (options.lockInterval ?? 8192) + 1024;

                    await redis.SET(refreshLockKey, "1", {
                        PX: refreshLockInterval,
                    });

                    const now = Date.now();
                    let data: Awaited<ReturnType<Options["fetch"]>> | undefined;
                    try {
                        data = await options.fetch();
                    } catch (error) {
                        await redis.DEL(refreshLockKey);
                        throw error;
                    }

                    // 处理永久保存的情况
                    let realExpireMs: number | null = options.realExpireMs ?? null;
                    if (options.expireMs !== null) {
                        realExpireMs = options.realExpireMs ?? Math.floor(options.expireMs * (Math.random() + 0.5)) + 8192;
                    }

                    // 计算过期时间
                    let effectiveExpireMs: number | null = null;
                    if (data !== undefined) {
                        if (options.expireMs !== null) {
                            effectiveExpireMs = options.expireMs + (realExpireMs ?? 0);
                        }
                        // 如果 expireMs 为 null，effectiveExpireMs 保持 null（永久保存）
                    } else {
                        effectiveExpireMs = options.notFoundExpireMs ?? (options.expireMs !== null ? Math.min(options.expireMs, 16384) : 86400000);
                    }

                    const cacheValue = {
                        T: now + (data !== undefined ? (options.expireMs ?? Number.MAX_SAFE_INTEGER) : (options.notFoundExpireMs ?? (options.expireMs !== null ? Math.min(options.expireMs, 16384) : 86400000))),
                        R: data,
                    };

                    if (effectiveExpireMs === null) {
                        // 永久保存
                        await redis.SET(key, JSON.stringify(cacheValue));
                    } else {
                        await redis.PSETEX(key, effectiveExpireMs, JSON.stringify(cacheValue));
                    }
                    // Do not clean the update lock! Instead, wait for it to expire naturally
                },
            };
        },

        useCount: (key: string) => ({
            get: async (): Promise<number> => {
                const result = await redis.GET(key);
                return result ? Number(result) : 0;
            },
            add: async (amount: number, expireMs?: number | null): Promise<number> => {
                if (expireMs === null) {
                    // 永久保存
                    const result = await redis.INCRBY(key, amount);
                    return result as number;
                } else if (!expireMs) {
                    const result = await redis.INCRBY(key, amount);
                    return result as number;
                } else {
                    const result = await redis.MULTI().INCRBY(key, amount).PEXPIRE(key, expireMs).EXEC();
                    return Number(result[0]) as number;
                }
            },
            sub: async (amount: number): Promise<number> => {
                const result = await redis.DECRBY(key, amount);
                return result as number;
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
                return result as number;
            },
            lastClockIn: async (): Promise<number> => {
                const result = await redis.BITPOS(key, 1, -1);
                return result as number;
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
                return result as number;
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

export type Redis = MilkioRedis;