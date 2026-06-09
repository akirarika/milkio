import { expect, test } from "vitest";
import { astra } from "../../../test.ts";

test.sequential("client disconnect stops server stream execution", async () => {
	const [context, reject, world] = await astra.createMirrorWorld(import.meta.url);

	const [error, results] = await world.execute("/stream/stream-cancel~", {
		type: "stream",
		generateParams: false,
	});
	if (error) throw reject("Milkio did not execute successfully", error);

	const values: number[] = [];
	for await (const [err, result] of results) {
		if (err) throw reject("stream error", err);
		values.push(result);
		if (values.length >= 5) break;
	}

	// Wait for server to process cancellation
	await new Promise((resolve) => setTimeout(resolve, 300));

	const [checkError, checkResult] = await world.execute("/stream/check-cancel-state", {
		generateParams: false,
	});
	if (checkError) throw reject("check state failed", checkError);

	expect(values.length).toBe(5);
	expect(checkResult.done).toBe(true);
	// Server should stop well before completing all 50 iterations
	expect(checkResult.yieldCount).toBeLessThan(50);
});

test.sequential("client disconnect via AbortController stops server", async () => {
	const [context, reject, world] = await astra.createMirrorWorld(import.meta.url);

	const [error, results] = await world.execute("/stream/stream-cancel~", {
		type: "stream",
		generateParams: false,
	});
	if (error) throw reject("Milkio did not execute successfully", error);

	const values: number[] = [];
	let count = 0;
	for await (const [err, result] of results) {
		if (err) throw reject("stream error", err);
		values.push(result);
		count++;
		if (count >= 3) {
			// Explicitly return the iterator to simulate disconnect
			await results.return(undefined);
			break;
		}
	}

	await new Promise((resolve) => setTimeout(resolve, 300));

	const [checkError, checkResult] = await world.execute("/stream/check-cancel-state", {
		generateParams: false,
	});
	if (checkError) throw reject("check state failed", checkError);

	expect(values.length).toBe(3);
	expect(checkResult.done).toBe(true);
	expect(checkResult.yieldCount).toBeLessThan(50);
});
