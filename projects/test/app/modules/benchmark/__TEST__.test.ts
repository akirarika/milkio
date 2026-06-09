import { describe, it, beforeAll, afterAll } from "vitest";
import { spawn, execSync, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { existsSync } from "node:fs";
import { platform } from "node:os";
import {
	type BenchmarkResult,
	printSingleReport,
	printComparisonTable,
} from "./utils/report.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, "../../..");
const FRAMEWORKS_DIR = resolve(__dirname, "$frameworks");
const IS_WINDOWS = platform() === "win32";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

interface FrameworkConfig {
	name: string;
	port: number;
	script: string;
	cwd: string;
	runtime: "bun" | "tsx";
	env?: Record<string, string>;
}

const FRAMEWORKS: Record<string, FrameworkConfig> = {
	milkio: {
		name: "milkio",
		port: 19000,
		script: "app/modules/benchmark/milkio-prod.ts",
		cwd: PROJECT_ROOT,
		runtime: "bun",
	},
	elysia: {
		name: "elysia",
		port: 19001,
		script: "app/modules/benchmark/$frameworks/elysia/server.ts",
		cwd: PROJECT_ROOT,
		runtime: "bun",
	},
	koa: {
		name: "koa",
		port: 19002,
		script: "app/modules/benchmark/$frameworks/koa/server.ts",
		cwd: PROJECT_ROOT,
		runtime: "bun",
	},
	nest: {
		name: "nest",
		port: 19003,
		script: "server.ts",
		cwd: resolve(FRAMEWORKS_DIR, "nest"),
		runtime: "tsx",
	},
};

const TOTAL_REQUESTS = 1000;
const CONCURRENCY_LEVELS = [1, 10, 50, 100];

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const serverProcesses: Map<string, ChildProcess> = new Map();
const allResults: BenchmarkResult[] = [];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function startServer(config: FrameworkConfig): ChildProcess {
	let cmd: string;
	let args: string[];

	if (config.runtime === "tsx") {
		cmd = "npx";
		args = ["tsx", config.script];
	} else {
		cmd = "bun";
		args = ["run", config.script];
	}

	const proc = spawn(cmd, args, {
		cwd: config.cwd,
		stdio: "pipe",
		env: { ...process.env, ...config.env, COOKBOOK_MODE: "test" },
	});

	proc.stdout?.on("data", (d: Buffer) => process.stdout.write(d));
	proc.stderr?.on("data", (d: Buffer) => process.stderr.write(d));
	proc.on("error", (err) => {
		console.error(`[${config.name}] spawn error:`, err);
	});

	return proc;
}

function killProcess(proc: ChildProcess): void {
	if (IS_WINDOWS) {
		// Windows: SIGKILL doesn't exist, use taskkill to ensure termination
		try {
			spawn("taskkill", ["/pid", String(proc.pid), "/f", "/t"]);
		} catch {
			proc.kill();
		}
	} else {
		try {
			proc.kill("SIGTERM");
		} catch {
			// already dead
		}
	}
}

async function waitForServer(
	url: string,
	timeoutMs = 30000,
): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		try {
			const res = await fetch(`${url}/benchmark/json`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ a: 1, b: 2 }),
				signal: AbortSignal.timeout(2000),
			});
			if (res.ok) return;
		} catch {
			// server not ready yet
		}
		await new Promise((r) => setTimeout(r, 300));
	}
	throw new Error(`Server ${url} did not become ready within ${timeoutMs}ms`);
}

async function warmup(url: string, n = 10): Promise<void> {
	for (let i = 0; i < n; i++) {
		try {
			await fetch(`${url}/benchmark/json`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ a: 1, b: 2 }),
			});
		} catch {
			// ignore warmup errors
		}
	}
}

async function benchHTTP(
	url: string,
	path: string,
	method: string,
	body: object | null,
	total: number,
	concurrency: number,
): Promise<Omit<BenchmarkResult, "framework" | "dimension" | "concurrency">> {
	const latencies: number[] = [];
	let success = 0;
	let fail = 0;

	const bodyText = body ? JSON.stringify(body) : undefined;
	const headers: Record<string, string> = body
		? { "content-type": "application/json" }
		: {};

	const startTime = performance.now();

	for (let i = 0; i < total; i += concurrency) {
		const batchSize = Math.min(concurrency, total - i);
		const batch = Array.from({ length: batchSize }, async () => {
			const reqStart = performance.now();
			try {
				const res = await fetch(`${url}${path}`, {
					method,
					headers,
					body: bodyText,
					signal: AbortSignal.timeout(10_000),
				});
				const elapsed = performance.now() - reqStart;
				latencies.push(elapsed);
				if (res.ok) success++;
				else fail++;
			} catch {
				const elapsed = performance.now() - reqStart;
				latencies.push(elapsed);
				fail++;
			}
		});
		await Promise.all(batch);
	}

	const endTime = performance.now();
	const totalTime = endTime - startTime;

	latencies.sort((a, b) => a - b);

	const avgLatency =
		latencies.length > 0
			? latencies.reduce((s, v) => s + v, 0) / latencies.length
			: 0;
	const qps = totalTime > 0 ? (success / totalTime) * 1000 : 0;
	const actualConcurrency =
		avgLatency > 0 ? qps * (avgLatency / 1000) : 0;

	return {
		totalRequests: total,
		success,
		fail,
		totalTime,
		qps,
		actualConcurrency,
		minLatency: latencies.length > 0 ? latencies[0] : 0,
		avgLatency,
		p50: latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.5)] : 0,
		p90: latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.9)] : 0,
		p99: latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.99)] : 0,
		maxLatency:
			latencies.length > 0 ? latencies[latencies.length - 1] : 0,
	};
}

// ---------------------------------------------------------------------------
// Lifecycle & Tests
// 使用 describe.skip 使 `co test` 跳过本文件，避免启动外部服务器。
// 手动运行: bun run vitest run app/modules/benchmark/__TEST__.test.ts
// ---------------------------------------------------------------------------

describe.skip("Benchmark (手动运行)", () => {
beforeAll(async () => {
	// Step 1: Verify .milkio has benchmark routes; build if missing
	const benchmarkRouteDir = resolve(
		PROJECT_ROOT,
		".milkio/transpiled/routes/modules__benchmark__jsonTaction",
	);
	if (!existsSync(benchmarkRouteDir)) {
		console.log("[setup] .milkio missing benchmark route, building...");
		execSync("bun run build", {
			cwd: PROJECT_ROOT,
			stdio: "inherit",
			timeout: 120_000,
		});
	}

	// Step 2: Start all framework servers
	console.log("[setup] Starting benchmark servers...");
	for (const [key, config] of Object.entries(FRAMEWORKS)) {
		console.log(`[setup] Starting ${config.name} on :${config.port}...`);
		const proc = startServer(config);
		serverProcesses.set(key, proc);
	}

	// Step 3: Wait for all servers
	for (const config of Object.values(FRAMEWORKS)) {
		const baseUrl = `http://localhost:${config.port}`;
		console.log(`[setup] Waiting for ${config.name} at ${baseUrl}...`);
		await waitForServer(baseUrl);
	}

	// Step 4: Warm up all frameworks
	console.log("[setup] Warming up all frameworks...");
	for (const config of Object.values(FRAMEWORKS)) {
		const baseUrl = `http://localhost:${config.port}`;
		await warmup(baseUrl);
	}

	console.log("[setup] All servers ready. Starting benchmarks...\n");
}, 120_000);

afterAll(async () => {
	// Stop all servers
	for (const [key, proc] of serverProcesses) {
		console.log(`[cleanup] Stopping ${key}...`);
		killProcess(proc);
	}

	// Give processes a moment to shut down
	await new Promise((r) => setTimeout(r, 1500));

	// Force kill any remaining stragglers
	for (const [key, proc] of serverProcesses) {
		if (proc.exitCode === null) {
			console.log(`[cleanup] Force killing ${key}...`);
			killProcess(proc);
		}
	}

	// Print final comparison
	printComparisonTable(allResults);
}, 30_000);

// ---------------------------------------------------------------------------
// Benchmark Tests
// ---------------------------------------------------------------------------

for (const concurrency of CONCURRENCY_LEVELS) {
	describe.sequential(`并发 C${concurrency}`, () => {
		for (const [key, config] of Object.entries(FRAMEWORKS)) {
			it.sequential(
				`${config.name} /benchmark/json`,
				{ timeout: 120_000 },
				async () => {
					const baseUrl = `http://localhost:${config.port}`;

					// Pre-warm again for this specific run
					await warmup(baseUrl, 5);

					const raw = await benchHTTP(
						baseUrl,
						"/benchmark/json",
						"POST",
						{ a: 1, b: 2 },
						TOTAL_REQUESTS,
						concurrency,
					);

					const result: BenchmarkResult = {
						framework: config.name,
						dimension: "JSON POST",
						concurrency,
						...raw,
					};

					printSingleReport(result);
					allResults.push(result);

					// Assert basic health
					if (raw.fail > raw.success * 0.01) {
						throw new Error(
							`${config.name} 失败率过高: ${raw.fail}/${raw.totalRequests}`,
						);
					}
				},
			);
		}
	});
}
});
