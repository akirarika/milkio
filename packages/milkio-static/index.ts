import type { RedisClientOptions } from "redis";
import { TSON } from "@southern-aurora/tson";
import { exit } from "node:process";

export type CacheEntity<T> = T;

type milkioRedisOptions = {
	initTimeout: number;
};

export type RedisClient = ReturnType<typeof defineRedisClient>;

export async function defineRedisClient(options: milkioRedisOptions & RedisClientOptions) {
	const timer = setTimeout(() => {
		console.error(`redis connect timeout, Are you sure that the REDIS_URL is configured and correct?`);
		exit(1);
	}, options?.initTimeout ?? 6000);
	const client = await createRedisClient(options);
	clearTimeout(timer);
	return client;
}

export function defineCache<Entity extends CacheEntity<unknown>, RT extends ReturnType<typeof defineRedisClient> = ReturnType<typeof defineRedisClient>>(redis: RT, key: string) {
	return {
		async get() {
			const redisClient = await redis;
			const res = await redisClient.get(`${key}`);
			if (res === null) return undefined;
			return TSON.parse(res) as Entity;
		},
		async set(value: Entity, TTL: number) {
			const redisClient = await redis;

			await redisClient.set(`${key}`, TSON.stringify(value), {
				EX: TTL,
			});
		},
		async del() {
			const redisClient = await redis;
			await redisClient.del(`${key}`);
		},
	};
}

export function defineNamespaceCache<Entity extends CacheEntity<unknown>, RT extends ReturnType<typeof defineRedisClient> = ReturnType<typeof defineRedisClient>>(redis: RT, key: string) {
	return {
		async get(namespace: string): Promise<Entity | undefined> {
			const redisClient = await redis;
			const res = await redisClient.get(`${key}:${namespace}`);
			if (res === null) return undefined;
			return TSON.parse(res) as Entity;
		},
		async set(namespace: string, value: Entity, TTL: number) {
			const redisClient = await redis;

			await redisClient.set(`${key}:${namespace}`, TSON.stringify(value), {
				EX: TTL,
			});
		},
		async del(namespace: string) {
			const redisClient = await redis;
			await redisClient.del(`${key}:${namespace}`);
		},
	};
}

export function defineResultCache<GetResult extends () => unknown | Promise<unknown>, RT extends ReturnType<typeof defineRedisClient> = ReturnType<typeof defineRedisClient>>(redis: RT, key: string, TTL: number, realTTL: number, getResultFn: GetResult, options?: { realGetInterval?: number }) {
	type ResultType = Awaited<ReturnType<GetResult>>;
	const ncache = defineNamespaceCache<{ r: ResultType; t: number }>(redis, "bao#result-cache");

	return {
		async getResult(optionsByGetResult?: { force?: boolean; skipCache?: boolean }): Promise<ResultType> {
			if (optionsByGetResult?.skipCache === true) {
				return (await getResultFn()) as ResultType;
			}
			let result = await ncache.get(key);
			if (result) {
				if (!optionsByGetResult?.force && result.t > Math.ceil(new Date().getTime() / 1000)) {
					return result.r;
				}
				const ncacheLock = defineNamespaceCache<boolean>(redis, "bao#result-cache-lock");
				const lock = await ncacheLock.get(key);
				if (lock === true) {
					return result.r;
				}
				await ncacheLock.set(key, true, options?.realGetInterval ?? 6);
			}
			result = { r: (await getResultFn()) as ResultType, t: Math.ceil(new Date().getTime() / 1000) + TTL };
			await ncache.set(key, result, TTL + realTTL + (options?.realGetInterval ?? 6));

			return result.r;
		},
	};
}

async function createRedisClient(options: RedisClientOptions) {
	const NodeRedis = await import("redis");
	const redisClient = await NodeRedis.createClient(options).connect();

	return redisClient;
}
