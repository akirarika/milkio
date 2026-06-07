import { expect, it } from "vitest";
import { astra } from "../../../test.ts";

/**
 * 并发请求测试
 * 验证多个请求同时发起时，系统能正确处理并发，
 * 每个请求独立执行，不会相互阻塞
 */
it.sequential("concurrent requests complete independently", async () => {
    const [context, reject, world] = await astra.createMirrorWorld(import.meta.url);

    const delays = [50, 50, 50];
    const startTime = Date.now();

    const promises = delays.map((delayMs) =>
        world.execute("/concurrency/delay", {
            params: { delayMs },
            generateParams: false,
        })
    );

    const results = await Promise.all(promises);

    for (const [error, result] of results) {
        if (error) throw reject("Milkio did not execute successfully", error);
    }

    const elapsed = Date.now() - startTime;

    expect(results.length).toBe(3);
    expect(elapsed).toBeLessThan(5000);
});

/**
 * 竞态条件测试
 * 验证并发写入共享计数器时数据一致性问题
 * 由于无锁保护，并发写入可能导致计数丢失
 */
it.sequential("race condition on shared counter", async () => {
    const [context, reject, world] = await astra.createMirrorWorld(import.meta.url);

    const [, resetResult] = await world.execute("/concurrency/counter", {
        params: { incrementBy: 0, delayMs: 0, reset: true },
        generateParams: false,
    });
    if (resetResult) expect(resetResult.afterValue).toBe(0);

    const concurrentCount = 5;
    const promises = [];

    for (let i = 0; i < concurrentCount; i++) {
        promises.push(
            world.execute("/concurrency/counter", {
                params: { incrementBy: 1, delayMs: 10, reset: false },
                generateParams: false,
            })
        );
    }

    const results = await Promise.all(promises);

    for (const [error] of results) {
        if (error) throw reject("Milkio did not execute successfully", error);
    }

    const afterValues = results.map(([, r]) => r!.afterValue);
    const maxValue = Math.max(...afterValues);

    expect(maxValue).toBeGreaterThanOrEqual(1);
    expect(maxValue).toBeLessThanOrEqual(concurrentCount);
});

/**
 * 顺序请求测试
 * 验证顺序执行时计数器正确递增
 */
it.sequential("sequential counter increments correctly", async () => {
    const [context, reject, world] = await astra.createMirrorWorld(import.meta.url);

    const [, resetResult] = await world.execute("/concurrency/counter", {
        params: { incrementBy: 0, delayMs: 0, reset: true },
        generateParams: false,
    });
    if (resetResult) expect(resetResult.afterValue).toBe(0);

    for (let i = 0; i < 3; i++) {
        const [error, result] = await world.execute("/concurrency/counter", {
            params: { incrementBy: 1, delayMs: 0, reset: false },
            generateParams: false,
        });
        if (error) throw reject("Milkio did not execute successfully", error);
    }

    const [error, result] = await world.execute("/concurrency/counter", {
        params: { incrementBy: 0, delayMs: 0, reset: false },
        generateParams: false,
    });
    if (error) throw reject("Milkio did not execute successfully", error);

    expect(result.afterValue).toBeGreaterThanOrEqual(3);
});