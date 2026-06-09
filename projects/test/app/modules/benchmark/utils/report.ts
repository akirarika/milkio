export interface BenchmarkResult {
	framework: string;
	dimension: string;
	concurrency: number;
	totalRequests: number;
	success: number;
	fail: number;
	totalTime: number;
	qps: number;
	actualConcurrency: number;
	minLatency: number;
	avgLatency: number;
	p50: number;
	p90: number;
	p99: number;
	maxLatency: number;
}

export function printSingleReport(r: BenchmarkResult): void {
	console.log(`\n========== [${r.framework}] ${r.dimension} @ C${r.concurrency} ==========`);
	console.log(`总请求数:       ${r.totalRequests}`);
	console.log(`并发数:         ${r.concurrency}`);
	console.log(`成功:           ${r.success}`);
	console.log(`失败:           ${r.fail}`);
	console.log(`总耗时:         ${r.totalTime.toFixed(2)} ms`);
	console.log(`实际并发量:     ${r.actualConcurrency.toFixed(2)}`);
	console.log(`QPS:            ${r.qps.toFixed(2)}`);
	console.log(`------- 延迟 (ms) -------`);
	console.log(`最小值:         ${r.minLatency.toFixed(3)}`);
	console.log(`平均值:         ${r.avgLatency.toFixed(3)}`);
	console.log(`P50:            ${r.p50.toFixed(3)}`);
	console.log(`P90:            ${r.p90.toFixed(3)}`);
	console.log(`P99:            ${r.p99.toFixed(3)}`);
	console.log(`最大值:         ${r.maxLatency.toFixed(3)}`);
	console.log("================================\n");
}

export function printComparisonTable(results: BenchmarkResult[]): void {
	const dims = [...new Set(results.map((r) => r.dimension))];
	const concs = [...new Set(results.map((r) => r.concurrency))].sort((a, b) => a - b);
	const fws = [...new Set(results.map((r) => r.framework))];

	console.log("\n╔══════════════════════════════════════════════════════════════════╗");
	console.log("║                    基准测试对比报告 (QPS)                        ║");
	console.log("╚══════════════════════════════════════════════════════════════════╝\n");

	for (const dim of dims) {
		for (const conc of concs) {
			console.log(`── ${dim} · 并发 C${conc} ──`);
			const sorted = results
				.filter((r) => r.dimension === dim && r.concurrency === conc)
				.sort((a, b) => b.qps - a.qps);

			const padFw = Math.max(...sorted.map((r) => r.framework.length), 8);
			const header = `${"框架".padEnd(padFw)} │ ${"QPS".padStart(10)} │ ${"avg(ms)".padStart(8)} │ ${"P50(ms)".padStart(8)} │ ${"P99(ms)".padStart(8)} │ ${"成功".padStart(6)}`;
			console.log(header);
			console.log("─".repeat(header.length));

			for (const r of sorted) {
				const rank = sorted.indexOf(r) + 1;
				const prefix = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : ` ${rank}`;
				console.log(
					`${prefix} ${r.framework.padEnd(padFw)} │ ${r.qps.toFixed(2).padStart(10)} │ ${r.avgLatency.toFixed(2).padStart(8)} │ ${r.p50.toFixed(2).padStart(8)} │ ${r.p99.toFixed(2).padStart(8)} │ ${String(r.success).padStart(6)}`,
				);
			}
			console.log();
		}
	}

	// Overall ranking by QPS (average across all dimensions)
	console.log("── 综合排名 (所有维度平均 QPS) ──");
	const avgByFw: Record<string, number> = {};
	for (const fw of fws) {
		const fwResults = results.filter((r) => r.framework === fw);
		avgByFw[fw] = fwResults.reduce((s, r) => s + r.qps, 0) / fwResults.length;
	}
	const sortedAvg = Object.entries(avgByFw).sort((a, b) => b[1] - a[1]);
	for (const [fw, avg] of sortedAvg) {
		const rank = sortedAvg.indexOf([fw, avg]) + 1;
		const prefix = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : ` ${rank}`;
		console.log(`${prefix} ${fw.padEnd(10)} ${avg.toFixed(2)} QPS`);
	}
	console.log();
}
