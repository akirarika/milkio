import { expect, test } from "vitest";

const BASE_URL = "http://localhost:9000";

test.sequential("oversized request body is rejected with REQUEST_TOO_LARGE", async () => {
  const res = await fetch(`${BASE_URL}/action/large-echo`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ content: "x".repeat(10 * 1024 * 1024 + 1) }),
  });
  expect(res.status).toBe(413);
  const data = await res.json() as any;
  expect(data.code).toBe("REQUEST_TOO_LARGE");
});
