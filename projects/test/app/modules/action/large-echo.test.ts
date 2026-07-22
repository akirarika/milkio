import { expect, test } from "vitest";
import { createHash } from "node:crypto";
import { stargate } from "../../../test.ts";

// 回归测试：HTTP 请求体按 ~64KB 一个 TCP 分片到达服务器，
// 历史上中间件/入口的 body 累积逻辑会丢失第 3 个分片，
// 导致超过约 128KB 的请求体被截断、JSON.parse 失败（PARAMS_TYPE_NOT_SUPPORTED）。
// 这里用远大于 128KB 的载荷确保请求一定会被拆成多个分片。

function makeLargeContent(size: number): string {
	// 确定性内容：包含多字节字符与转义字符，确保 JSON 编码后体积更大且内容可校验
	const unit = "kecream-milkio-large-body-测试-\"quoted\"-\\slash-\n";
	let content = "";
	while (content.length < size) content += unit;
	return content.slice(0, size);
}

function md5(text: string): string {
	return createHash("md5").update(text, "utf-8").digest("hex");
}

test.sequential("large body (~512KB) via stargate.execute arrives intact", async () => {
	const content = makeLargeContent(512 * 1024);
	const [error, result] = await stargate.execute("/action/large-echo", {
		params: { content },
	});

	expect(error).toBeNull();
	expect(result).toBeDefined();
	expect(result!.length).toBe(content.length);
	expect(result!.md5).toBe(md5(content));
});

test.sequential("large body (~2MB) via raw fetch arrives intact", async () => {
	const content = makeLargeContent(2 * 1024 * 1024);
	const body = JSON.stringify({ content });

	const response = await fetch("http://localhost:9000/action/large-echo", {
		method: "POST",
		headers: { "Content-Type": "application/json", Accept: "application/json" },
		body,
	});
	const parsed = (await response.json()) as any;

	expect(parsed.success, `expected success, got: ${JSON.stringify(parsed).slice(0, 300)}`).toBe(true);
	expect(parsed.data.length).toBe(content.length);
	expect(parsed.data.md5).toBe(md5(content));
});

test.sequential("small body still works via raw fetch", async () => {
	const content = "hello-milkio";
	const response = await fetch("http://localhost:9000/action/large-echo", {
		method: "POST",
		headers: { "Content-Type": "application/json", Accept: "application/json" },
		body: JSON.stringify({ content }),
	});
	const parsed = (await response.json()) as any;

	expect(parsed.success).toBe(true);
	expect(parsed.data.length).toBe(content.length);
	expect(parsed.data.md5).toBe(md5(content));
});
