import { describe, expect, it } from "vite-plus/test";
import { __cacheTick, __configureMilkioCache, defineMilkioBloomFilter, defineMilkioKVCache, defineMilkioMemoCache } from "./index.ts";

const baseOptions = { expireMs: null, maxEntries: 16, intervalMs: 128 } as const;

describe("KV cache", () => {
    it("miss returns undefined, set/get/has/delete/pull/clear work", () => {
        const cache = defineMilkioKVCache<number>({ ...baseOptions });

        expect(cache.get("missing")).toBeUndefined();
        expect(cache.has("missing")).toBe(false);

        cache.set("a", 1);
        expect(cache.get("a")).toBe(1);
        expect(cache.has("a")).toBe(true);
        expect(cache.size()).toBe(1);

        cache.delete("a");
        expect(cache.get("a")).toBeUndefined();

        cache.set("b", 2);
        expect(cache.pull("b")).toBe(2);
        expect(cache.has("b")).toBe(false);

        cache.set("c", 3);
        cache.clear();
        expect(cache.size()).toBe(0);
    });

    it("expired entry is treated as missing and removed lazily", async () => {
        const cache = defineMilkioKVCache<number>({ expireMs: 10, maxEntries: 16, intervalMs: 128 });

        cache.set("a", 1);
        expect(cache.get("a")).toBe(1);

        await new Promise((resolve) => setTimeout(resolve, 25));
        expect(cache.get("a")).toBeUndefined();
        expect(cache.size()).toBe(0);
    });

    it("evicts least recently used entry when maxEntries is exceeded", () => {
        const cache = defineMilkioKVCache<number>({ expireMs: null, maxEntries: 2, intervalMs: 128 });

        cache.set("a", 1);
        cache.set("b", 2);
        // 读 a 把它挪到队尾，此后 b 才是最久未使用
        expect(cache.get("a")).toBe(1);
        cache.set("c", 3);

        expect(cache.get("a")).toBe(1);
        expect(cache.get("b")).toBeUndefined();
        expect(cache.get("c")).toBe(3);
        expect(cache.size()).toBe(2);
    });

    it("setIfAbsent only writes when the key is missing or expired", async () => {
        const cache = defineMilkioKVCache<number>({ expireMs: 10, maxEntries: 16, intervalMs: 128 });

        expect(cache.setIfAbsent("a", 1)).toBe(true);
        expect(cache.setIfAbsent("a", 2)).toBe(false);
        expect(cache.get("a")).toBe(1);

        await new Promise((resolve) => setTimeout(resolve, 25));
        expect(cache.setIfAbsent("a", 3)).toBe(true);
        expect(cache.get("a")).toBe(3);
    });
});

describe("Memo cache", () => {
    it("caches loader result and does not call loader again", async () => {
        const cache = defineMilkioMemoCache<number>({ ...baseOptions });
        let calls = 0;

        const loader = async () => {
            calls += 1;
            return 42;
        };

        expect(await cache.run(loader)).toBe(42);
        expect(await cache.run(loader)).toBe(42);
        expect(calls).toBe(1);
    });

    it("merges concurrent calls for the same key into one loader call", async () => {
        const cache = defineMilkioMemoCache<number>({ ...baseOptions });
        let calls = 0;

        const loader = async () => {
            calls += 1;
            await new Promise((resolve) => setTimeout(resolve, 10));
            return 7;
        };

        const [first, second] = await Promise.all([cache.run(loader), cache.run(loader)]);
        expect(first).toBe(7);
        expect(second).toBe(7);
        expect(calls).toBe(1);
    });

    it("keeps different keys isolated", async () => {
        const cache = defineMilkioMemoCache<number>({ ...baseOptions });
        let calls = 0;

        expect(await cache.run("a", async () => (calls += 1))).toBe(1);
        expect(await cache.run("b", async () => (calls += 1))).toBe(2);
        expect(await cache.run("a", async () => (calls += 1))).toBe(1);
        expect(calls).toBe(2);
    });

    it("does not cache a rejected loader", async () => {
        const cache = defineMilkioMemoCache<number>({ ...baseOptions });
        let calls = 0;

        await expect(
            cache.run(async () => {
                calls += 1;
                throw new Error("boom");
            }),
        ).rejects.toThrow("boom");

        expect(
            await cache.run(async () => {
                calls += 1;
                return 1;
            }),
        ).toBe(1);
        expect(calls).toBe(2);
    });

    it("delete() without key clears everything", async () => {
        const cache = defineMilkioMemoCache<number>({ ...baseOptions });
        await cache.run(async () => 1);
        expect(cache.size()).toBe(1);

        cache.delete();
        expect(cache.size()).toBe(0);
    });
});

describe("Bloom filter", () => {
    it("never reports a false negative; clear() resets all bits", () => {
        const filter = defineMilkioBloomFilter({ expectedEntries: 1024, falsePositiveRate: 0.01 });

        for (let index = 0; index < 500; index++) filter.add(`value-${index}`);
        for (let index = 0; index < 500; index++) expect(filter.mightContain(`value-${index}`)).toBe(true);
        expect(filter.estimatedCount()).toBe(500);

        filter.clear();
        expect(filter.estimatedCount()).toBe(0);
        expect(filter.mightContain("value-0")).toBe(false);
    });

    it("rejects invalid options", () => {
        expect(() => defineMilkioBloomFilter({ expectedEntries: 0, falsePositiveRate: 0.01 })).toThrow();
        expect(() => defineMilkioBloomFilter({ expectedEntries: 100, falsePositiveRate: 1 })).toThrow();
    });
});

describe("option validation", () => {
    it("requires explicit expireMs / maxEntries / intervalMs", () => {
        expect(() => defineMilkioKVCache<number>({ expireMs: null, maxEntries: 0, intervalMs: 128 })).toThrow();
        expect(() => defineMilkioKVCache<number>({ expireMs: 0, maxEntries: 1, intervalMs: 128 })).toThrow();
        expect(() => defineMilkioKVCache<number>({ expireMs: null, maxEntries: 1, intervalMs: 100 })).toThrow();
    });
});

describe("active sweep", () => {
    it("removes expired entries when a tick is due", async () => {
        const cache = defineMilkioKVCache<number>({ expireMs: 10, maxEntries: 1000, intervalMs: 128 });

        for (let index = 0; index < 40; index++) cache.set(`k${index}`, index);
        await new Promise((resolve) => setTimeout(resolve, 25));
        expect(cache.size()).toBe(40);

        __cacheTick();

        // 全部过期：每批 16 条、过期比例 100%，会在预算内连续清理直到表尾
        expect(cache.size()).toBe(0);
    });

    it("skips instances whose interval has not elapsed", async () => {
        const cache = defineMilkioKVCache<number>({ expireMs: 10, maxEntries: 1000, intervalMs: 128 });

        for (let index = 0; index < 40; index++) cache.set(`k${index}`, index);
        await new Promise((resolve) => setTimeout(resolve, 25));

        __cacheTick();
        expect(cache.size()).toBe(0);

        // 第二次 tick 距上一次远小于 intervalMs，不应做任何事（这里用新条目验证）
        cache.set("fresh", 1);
        __cacheTick();
        expect(cache.get("fresh")).toBe(1);
    });

    it("evicts progressively when the memory limit is exceeded", async () => {
        const cache = defineMilkioKVCache<number>({ expireMs: null, maxEntries: 1000, intervalMs: 128 });
        for (let index = 0; index < 320; index++) cache.set(`k${index}`, index);

        // 1 字节的水位必然超限，触发跨表 LRU 逐出（每表约 1/16）
        __configureMilkioCache({ memoryLimitBytes: 1 });
        await new Promise((resolve) => setTimeout(resolve, 5));
        __cacheTick();
        __configureMilkioCache({ memoryLimitBytes: undefined });

        expect(cache.size()).toBeLessThan(320);
        expect(cache.size()).toBeGreaterThan(0);
    });
});
