import { it } from "vitest";
import { astra } from "../../../test.ts";

it.sequential("performance - QPS and latency", async () => {
    const [context, reject, world] = await astra.createMirrorWorld(import.meta.url);

    const totalRequests = 1000;
    const concurrency = 500;

    // Warm up
    await world.execute("/hello-world", {
        params: { a: "1", b: 1 },
        generateParams: false
    });

    // 等待 1 秒后开始正式测试
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const latencies: number[] = [];
    let successCount = 0;
    let failCount = 0;

    const startTime = performance.now();

    // Execute in batches with concurrency limit
    for (let i = 0; i < totalRequests; i += concurrency) {
        const batchSize = Math.min(concurrency, totalRequests - i);
        const batch = Array.from({ length: batchSize }, async () => {
            const reqStart = performance.now();
            const [error] = await world.execute("/hello-world", {
                params: { a: "1", b: 1 },
                generateParams: false
            });
            const reqEnd = performance.now();
            latencies.push(reqEnd - reqStart);
            if (error) failCount++;
            else successCount++;
        });
        await Promise.all(batch);
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;

    // Calculate QPS
    const qps = (successCount / totalTime) * 1000;

    // Calculate latency statistics (ms)
    latencies.sort((a, b) => a - b);
    const avgLatency = latencies.reduce((sum, v) => sum + v, 0) / latencies.length;
    const p50 = latencies[Math.floor(latencies.length * 0.5)];
    const p90 = latencies[Math.floor(latencies.length * 0.9)];
    const p99 = latencies[Math.floor(latencies.length * 0.99)];
    const minLatency = latencies[0];
    const maxLatency = latencies[latencies.length - 1];

    // 通过 QPS 和平均延迟推算实际并发量 (Little's Law: L = λ * W)
    const actualConcurrency = qps * (avgLatency / 1000);

    console.log("\n========== 性能报告 ==========");
    console.log(`总请求数:        ${totalRequests}`);
    console.log(`并发数:          ${concurrency}`);
    console.log(`成功:            ${successCount}`);
    console.log(`失败:            ${failCount}`);
    console.log(`总耗时:          ${totalTime.toFixed(2)} ms`);
    console.log(`并发量:      ${actualConcurrency.toFixed(2)}`);
    console.log(`QPS:             ${qps.toFixed(2)}`);
    console.log(`------- 延迟 (ms) -------`);
    console.log(`最小值:          ${minLatency.toFixed(3)}`);
    console.log(`平均值:          ${avgLatency.toFixed(3)}`);
    console.log(`P50:             ${p50.toFixed(3)}`);
    console.log(`P90:             ${p90.toFixed(3)}`);
    console.log(`P99:             ${p99.toFixed(3)}`);
    console.log(`最大值:          ${maxLatency.toFixed(3)}`);
    console.log("================================\n");
});
