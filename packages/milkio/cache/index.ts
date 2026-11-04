/**
 * milkio 进程内缓存：KV、Memo、Bloom 三种模型。
 *
 * 设计要点：
 *
 * 1. 没有序列化。值原样存放在 Map 里，可以存对象、Date、类实例。
 *
 * 2. 过期有两条路径：
 *    - 惰性过期：读命中后发现已过期，立即删除并当作未命中（保证正确性）；
 *    - 主动清理：请求末尾触发，按表级 intervalMs 节流，每批只取 16 条，
 *      本批过期比例达到 25% 才继续下一批，单次总耗时不超过 16ms。
 *      没有定时器：serverless 在请求之间会冻结 CPU，定时器不可靠。
 *
 * 3. 容量由 maxEntries 硬约束，写入时立即淘汰最旧的一条（LRU），
 *    所以主动清理只负责回收内存，不负责防止无限增长。
 *
 * 4. 内存水位来自 createWorld 的 memoryLimitBytes。只有运行时能读到可信的
 *    heapUsed（Node 进程 / Node worker）才参与判断；浏览器 Worker 与
 *    EdgeOne/Cloudflare 等 isolate 环境自动跳过，其余能力不受影响。
 */

/** 每批清理的条目数 */
const SAMPLE_SIZE = 16;

/** 本批过期比例达到该值才继续清理下一批（Redis activeExpireCycle 的阈值策略） */
const EXPIRED_RATIO_THRESHOLD = 0.25;

/** 单次清理的总耗时上限（毫秒），避免请求停顿 */
const SWEEP_BUDGET_MS = 16;

/** 表级清理间隔下限（毫秒）：短时大量请求同时结束时不至于反复争抢清理 */
const MIN_INTERVAL_MS = 128;

/** 单调时钟：优先 performance.now，浏览器 Worker 与 Node 都有；极端环境回退 Date.now */
const clock: () => number = typeof performance !== "undefined" && typeof performance.now === "function" ? () => performance.now() : () => Date.now();

export type MilkioCacheOptions = {
    /** 条目过期毫秒；永不过期必须显式传 null */
    expireMs: number | null;
    /** 本表条目数上限，超出时写入即淘汰最旧（LRU） */
    maxEntries: number;
    /** 本表主动清理间隔毫秒，最小 128 */
    intervalMs: number;
};

export type MilkioKVCache<T> = {
    /** 未命中返回 undefined（与 drizzle relational query 的 findFirst 对齐） */
    get(key: string): T | undefined;
    set(key: string, value: T): T;
    /** key 不存在或已过期时写入并返回 true；否则不写入返回 false */
    setIfAbsent(key: string, value: T): boolean;
    has(key: string): boolean;
    delete(key: string): void;
    /** 读取并删除 */
    pull(key: string): T | undefined;
    clear(): void;
    size(): number;
};

export type MilkioMemoCache<T> = {
    /** 无 key 时内部固定使用 "$" */
    run(loader: () => Promise<T>): Promise<T>;
    run(key: string, loader: () => Promise<T>): Promise<T>;
    delete(key?: string): void;
    clear(): void;
    size(): number;
};

export type MilkioBloomFilter = {
    add(value: string): void;
    /** 有假阳性：返回 true 只代表“可能存在” */
    mightContain(value: string): boolean;
    clear(): void;
    estimatedCount(): number;
};

type CacheEntry<T> = {
    value: T;
    /** null 表示永不过期 */
    expireAt: number | null;
};

function validateCacheOptions(options: MilkioCacheOptions): void {
    if (options === null || typeof options !== "object") throw new Error("milkio cache: options is required");
    if (options.expireMs !== null && (typeof options.expireMs !== "number" || !Number.isFinite(options.expireMs) || options.expireMs <= 0)) {
        throw new Error("milkio cache: expireMs must be a positive number or null");
    }
    if (typeof options.maxEntries !== "number" || !Number.isInteger(options.maxEntries) || options.maxEntries <= 0) {
        throw new Error("milkio cache: maxEntries must be a positive integer");
    }
    if (typeof options.intervalMs !== "number" || !Number.isInteger(options.intervalMs) || options.intervalMs < MIN_INTERVAL_MS) {
        throw new Error(`milkio cache: intervalMs must be an integer >= ${MIN_INTERVAL_MS}`);
    }
}

/**
 * 读取当前 isolate 的堆占用。
 * Node 进程、node:worker_threads、Node 实验性 Web Worker 都能读；
 * Bun 的 process.memoryUsage().heapUsed 返回 0，浏览器 Worker 没有 process，
 * 因此以“有限正数”作为可信判据，其余情况返回 null 让调用方降级。
 */
export function readHeapUsedBytes(): number | null {
    const processLike = (globalThis as any).process;
    if (processLike === undefined || typeof processLike.memoryUsage !== "function") return null;
    try {
        const used = processLike.memoryUsage()?.heapUsed;
        if (typeof used !== "number" || !Number.isFinite(used) || used <= 0) return null;
        return used;
    } catch {
        return null;
    }
}

/**
 * KV / Memo 共用的存储核心。
 * 每个实例独立一张 Map，插入顺序就是 LRU 顺序：读命中时 delete + set 挪到队尾。
 */
class CacheStore<T> {
    readonly map = new Map<string, CacheEntry<T>>();
    readonly expireMs: number | null;
    readonly maxEntries: number;
    readonly intervalMs: number;

    lastSweepAt = 0;
    private sweepIterator: Iterator<[string, CacheEntry<T>]> | null = null;

    constructor(options: MilkioCacheOptions) {
        validateCacheOptions(options);
        this.expireMs = options.expireMs;
        this.maxEntries = options.maxEntries;
        this.intervalMs = options.intervalMs;
    }

    /** 读：命中且未过期时把条目挪到队尾；已过期则删除并当作未命中 */
    read(key: string): { found: boolean; value?: T } {
        const entry = this.map.get(key);
        if (entry === undefined) return { found: false };

        if (entry.expireAt !== null && entry.expireAt <= clock()) {
            this.map.delete(key);
            return { found: false };
        }

        this.map.delete(key);
        this.map.set(key, entry);
        return { found: true, value: entry.value };
    }

    /** 写：覆盖或新增都挪到队尾，超过 maxEntries 立即淘汰队首（最久未使用） */
    write(key: string, value: T): void {
        const expireAt = this.expireMs === null ? null : clock() + this.expireMs;

        if (this.map.has(key)) this.map.delete(key);
        this.map.set(key, { value, expireAt });

        if (this.map.size > this.maxEntries) {
            const oldest = this.map.keys().next();
            if (oldest.done === false) this.map.delete(oldest.value);
        }
    }

    has(key: string): boolean {
        return this.read(key).found;
    }

    delete(key: string): void {
        this.map.delete(key);
    }

    clear(): void {
        this.map.clear();
        this.sweepIterator = null;
    }

    /**
     * 主动清理一批过期条目。
     * 返回 true 表示迭代器已经走完表尾（下个 tick 从表头重新开始）。
     * 迭代器跨 tick 继续，不重建、不回到表头，因此常态只检查尚未检查过的区间。
     */
    sweep(now: number, deadline: number): void {
        if (this.map.size === 0) {
            this.sweepIterator = null;
            return;
        }

        if (this.sweepIterator === null) this.sweepIterator = this.map.entries();

        for (;;) {
            let removedInBatch = 0;

            for (let index = 0; index < SAMPLE_SIZE; index++) {
                const next = this.sweepIterator.next();
                if (next.done) {
                    this.sweepIterator = null;
                    return;
                }
                const [key, entry] = next.value;
                if (entry.expireAt !== null && entry.expireAt <= now) {
                    this.map.delete(key);
                    removedInBatch += 1;
                }
            }

            // 本批过期比例低说明表内过期数据已经清理得差不多，本轮到此为止；
            // 比例高则继续下一批，直到时间预算用尽（大量条目同时过期时快速回收）
            if (removedInBatch / SAMPLE_SIZE < EXPIRED_RATIO_THRESHOLD) return;
            if (clock() > deadline) return;
        }
    }
}

const stores: Array<CacheStore<any>> = [];

let cursor = 0;
let memoryLimitBytes: number | undefined;

/** createWorld 初始化时调用，设置全局内存水位 */
export function __configureMilkioCache(options: { memoryLimitBytes?: number }): void {
    memoryLimitBytes = options.memoryLimitBytes;
}

/**
 * 请求末尾的缓存维护入口（由 execute 的 finales 最后一项调用）。
 *
 * 热路径成本：遍历所有缓存表做一次时间戳比较。表数量按“一个复杂工程最多 100 张”
 * 设计，实测 100 个表约 87ns/请求。
 */
export function __cacheTick(): void {
    if (stores.length === 0) return;

    const now = clock();
    const tickStartedAt = now;
    let maintained = false;

    for (let index = 0; index < stores.length; index++) {
        const store = stores[(cursor + index) % stores.length]!;
        if (now - store.lastSweepAt < store.intervalMs) continue;

        // 单次 tick 的总预算：前面的表清理耗时过多就让后面的表等下一轮，
        // 避免一个请求里停顿太久
        if (maintained && clock() - tickStartedAt > SWEEP_BUDGET_MS) break;

        store.lastSweepAt = now;
        store.sweep(now, tickStartedAt + SWEEP_BUDGET_MS);
        maintained = true;
    }

    cursor = (cursor + 1) % stores.length;

    if (!maintained) return;
    if (memoryLimitBytes === undefined) return;

    const used = readHeapUsedBytes();
    if (used === null || used <= memoryLimitBytes) return;

    // 超过水位：跨表按 LRU 逐出，每表约 1/16，受同一时间预算约束。
    // 逐出是渐进的，一次不会清空缓存（重建缓存本身也要花 CPU）。
    for (let index = 0; index < stores.length; index++) {
        if (clock() - tickStartedAt > SWEEP_BUDGET_MS) break;
        const store = stores[(cursor + index) % stores.length]!;
        const quota = Math.max(1, Math.ceil(store.map.size / 16));
        for (let count = 0; count < quota; count++) {
            const oldest = store.map.keys().next();
            if (oldest.done) break;
            store.map.delete(oldest.value);
        }
    }
}

/** 定义 KV 缓存 */
export function defineMilkioKVCache<T>(options: MilkioCacheOptions): MilkioKVCache<T> {
    const store = new CacheStore<T>(options);
    stores.push(store);

    return {
        get: (key: string) => {
            const result = store.read(key);
            return result.found ? result.value : undefined;
        },
        set: (key: string, value: T) => {
            store.write(key, value);
            return value;
        },
        setIfAbsent: (key: string, value: T) => {
            if (store.read(key).found) return false;
            store.write(key, value);
            return true;
        },
        has: (key: string) => store.has(key),
        delete: (key: string) => store.delete(key),
        pull: (key: string) => {
            const result = store.read(key);
            if (result.found === false) return undefined;
            store.delete(key);
            return result.value;
        },
        clear: () => store.clear(),
        size: () => store.map.size,
    };
}

/** 定义 Memo 缓存（闭包结果缓存，loader 必须是 async） */
export function defineMilkioMemoCache<T>(options: MilkioCacheOptions): MilkioMemoCache<T> {
    const store = new CacheStore<T>(options);
    stores.push(store);

    /** 同一 key 的并发调用共用同一个 Promise，避免同时回源 */
    const inflight = new Map<string, Promise<T>>();

    const run = (key: string, loader: () => Promise<T>): Promise<T> => {
        const cached = store.read(key);
        if (cached.found) return Promise.resolve(cached.value as T);

        const existing = inflight.get(key);
        if (existing !== undefined) return existing;

        const promise = Promise.resolve()
            .then(loader)
            .then(
                (value) => {
                    inflight.delete(key);
                    store.write(key, value);
                    return value;
                },
                (error) => {
                    inflight.delete(key);
                    throw error;
                },
            );

        inflight.set(key, promise);
        return promise;
    };

    return {
        run: ((keyOrLoader: string | (() => Promise<T>), maybeLoader?: () => Promise<T>) => {
            if (typeof keyOrLoader === "string") return run(keyOrLoader, maybeLoader!);
            return run("$", keyOrLoader as () => Promise<T>);
        }) as MilkioMemoCache<T>["run"],
        delete: (key?: string) => {
            if (key === undefined) store.clear();
            else store.delete(key);
        },
        clear: () => {
            store.clear();
            inflight.clear();
        },
        size: () => store.map.size,
    };
}

/** 定义布隆过滤器（无 TTL、无逐出，位图整体固定大小） */
export function defineMilkioBloomFilter(options: { expectedEntries: number; falsePositiveRate: number }): MilkioBloomFilter {
    if (typeof options?.expectedEntries !== "number" || !Number.isInteger(options.expectedEntries) || options.expectedEntries <= 0) {
        throw new Error("milkio bloom filter: expectedEntries must be a positive integer");
    }
    if (typeof options?.falsePositiveRate !== "number" || !Number.isFinite(options.falsePositiveRate) || options.falsePositiveRate <= 0 || options.falsePositiveRate >= 1) {
        throw new Error("milkio bloom filter: falsePositiveRate must be in (0, 1)");
    }

    const expectedEntries = options.expectedEntries;
    const falsePositiveRate = options.falsePositiveRate;
    const ln2 = Math.LN2;
    // m = -n·ln(p) / (ln2)²，k = (m/n)·ln2
    const bitCount = Math.max(1, Math.ceil((-expectedEntries * Math.log(falsePositiveRate)) / (ln2 * ln2)));
    const hashCount = Math.max(1, Math.round((bitCount / expectedEntries) * ln2));
    const byteCount = Math.ceil(bitCount / 8);

    let bits = new Uint8Array(byteCount);
    let added = 0;

    const hash1 = (value: string): number => {
        let hash = 0x811c9dc5;
        for (let index = 0; index < value.length; index++) {
            hash ^= value.charCodeAt(index);
            hash = Math.imul(hash, 0x01000193);
        }
        return hash >>> 0;
    };

    const hash2 = (value: string): number => {
        let hash = 0;
        for (let index = 0; index < value.length; index++) {
            hash = Math.imul(hash ^ value.charCodeAt(index), 0x5bd1e995);
            hash ^= hash >>> 13;
        }
        return hash >>> 0;
    };

    const testAndSet = (value: string, onlyTest: boolean): boolean => {
        const first = hash1(value);
        const second = hash2(value) | 1;
        let present = true;
        for (let index = 0; index < hashCount; index++) {
            // Math.imul 的结果是有符号 32 位，先转无符号再取模，避免负下标绕过位图
            const position = (first + Math.imul(index, second)) >>> 0;
            const bitIndex = position % bitCount;
            const byteIndex = bitIndex >>> 3;
            const mask = 1 << (bitIndex & 7);
            if (onlyTest) {
                if ((bits[byteIndex]! & mask) === 0) present = false;
            } else {
                bits[byteIndex] = bits[byteIndex]! | mask;
            }
        }
        return present;
    };

    return {
        add: (value: string) => {
            testAndSet(value, false);
            added += 1;
        },
        mightContain: (value: string) => testAndSet(value, true),
        clear: () => {
            bits = new Uint8Array(byteCount);
            added = 0;
        },
        estimatedCount: () => added,
    };
}
