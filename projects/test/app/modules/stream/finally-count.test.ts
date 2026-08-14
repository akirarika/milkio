import { expect, test } from "vitest";

const BASE_URL = "http://localhost:9000";

test.sequential("stream onFinally runs exactly once on client abort", async () => {
  const ac = new AbortController();
  const res = await fetch(`${BASE_URL}/stream/stream-cancel~`, {
    method: "POST",
    headers: { "Accept": "text/event-stream", "Content-Type": "application/json" },
    body: JSON.stringify({}),
    signal: ac.signal,
  });
  expect(res.ok).toBe(true);

  const reader = res.body!.getReader();
  await reader.read();
  ac.abort();
  try {
    await reader.read();
  } catch {}

  await new Promise((resolve) => setTimeout(resolve, 500));

  const checkRes = await fetch(`${BASE_URL}/stream/check-cancel-state`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const data = await checkRes.json() as any;
  expect(data.success).toBe(true);
  expect(data.data.finallyCount).toBe(1);
});
