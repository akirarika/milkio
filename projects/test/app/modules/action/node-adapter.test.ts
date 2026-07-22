import { afterAll, beforeAll, expect, test } from "vitest";
import { createHash } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

// 回归测试：cookbook 生成的 node 入口（.milkio/run.ts）曾在大请求体（>128KB，
// 即超过 2 个约 64KB 的 TCP 分片）时丢失第 3 个分片，导致 JSON.parse 失败。
// 本测试文件会随 .prepare.ts 同步到 test（node）/ test-bun / test-deno 三个项目，
// 读取各项目真实生成的 .milkio/run.ts：
// - 所有运行时：断言生成物中不存在有缺陷的 bodyBuffer 累积逻辑
// - node 运行时：额外真实启动该入口并 POST 大 body 验证完整性

const PORT = 18347;
// run.ts 中 import 的是 "../index.ts"，因此副本必须放在项目目录之下
const GENERATED_RUN = join(import.meta.dirname, "../../../.milkio/run.ts");
const RUN_DIR = join(import.meta.dirname, "../../../.milkio-node-test");

// 收集期同步判定运行时口味（test.skip 选项在收集期求值）
const generatedCode = readFileSync(GENERATED_RUN, "utf-8");
const isNodeFlavor = generatedCode.includes("node:http");

let serverProcess: ChildProcess | null = null;
let serverOutput = "";

async function waitForServer(timeoutMs: number): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		try {
			const response = await fetch(`http://localhost:${PORT}/generate_204`);
			if (response.status < 500) return;
		} catch {
			// not ready yet
		}
		await new Promise((resolve) => setTimeout(resolve, 500));
	}
	throw new Error(`node adapter server did not start within ${timeoutMs}ms. output:\n${serverOutput}`);
}

beforeAll(async () => {
	if (!isNodeFlavor) return;

	// 将硬编码端口替换为测试端口，避免与 dev server 冲突
	const patched = generatedCode.replace(/port: \d+/, `port: ${PORT}`);
	if (patched === generatedCode) throw new Error("failed to patch port in generated run.ts");

	await rm(RUN_DIR, { recursive: true, force: true });
	await mkdir(RUN_DIR, { recursive: true });
	await writeFile(join(RUN_DIR, "run.ts"), patched, "utf-8");

	serverProcess = spawn("bun", [join(RUN_DIR, "run.ts")], {
		env: { ...process.env, MILKIO_PORT: String(PORT) },
		stdio: ["ignore", "pipe", "pipe"],
	});
	serverProcess.stdout?.on("data", (chunk) => (serverOutput += chunk));
	serverProcess.stderr?.on("data", (chunk) => (serverOutput += chunk));

	await waitForServer(60_000);
}, 90_000);

afterAll(async () => {
	serverProcess?.kill("SIGINT");
	serverProcess = null;
	await rm(RUN_DIR, { recursive: true, force: true });
});

test.sequential("generated run.ts contains no buggy body buffering", async () => {
	const code = await readFile(GENERATED_RUN, "utf-8");
	expect(code).not.toContain("bodyBuffer");
	if (isNodeFlavor) {
		expect(code).toContain("bodyChunks.push(chunk);");
	}
});

test.sequential("large body (~1MB) through node adapter arrives intact", { skip: !isNodeFlavor }, async () => {
	const unit = "kecream-milkio-node-adapter-测试-\"quoted\"-\n";
	let content = "";
	while (content.length < 1024 * 1024) content += unit;
	content = content.slice(0, 1024 * 1024);

	const response = await fetch(`http://localhost:${PORT}/action/large-echo`, {
		method: "POST",
		headers: { "Content-Type": "application/json", Accept: "application/json" },
		body: JSON.stringify({ content }),
	});
	const parsed = (await response.json()) as any;

	expect(parsed.success, `expected success, got: ${JSON.stringify(parsed).slice(0, 300)}`).toBe(true);
	expect(parsed.data.length).toBe(content.length);
	expect(parsed.data.md5).toBe(createHash("md5").update(content, "utf-8").digest("hex"));
});

test.sequential("empty body through node adapter does not crash", { skip: !isNodeFlavor }, async () => {
	const response = await fetch(`http://localhost:${PORT}/action/large-echo`, {
		method: "POST",
		headers: { "Content-Type": "application/json", Accept: "application/json" },
	});
	const parsed = (await response.json()) as any;
	// 空 body 应当得到正常的参数校验失败，而不是服务器崩溃或挂起
	expect(parsed.success).toBe(false);
	expect(parsed.code).toBeDefined();
});
