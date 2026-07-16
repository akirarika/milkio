import { expect, test } from "vitest";
import { astra, stargate } from "../../../test.ts";

test.sequential("Date param roundtrip via world.execute", async () => {
	const [context, reject, world] = await astra.createMirrorWorld(import.meta.url);
	const testDate = new Date("2025-06-15T10:30:00.000Z");

	const [error, result] = await world.execute("/action/date-echo", {
		params: { date: testDate },
		generateParams: false,
	});
	if (error) throw reject("execution failed", error);

	expect(result.isDate).toBe(true);
	expect(result.timestamp).toBe(testDate.getTime());
	// iso is revived to Date by client-side reviveJSONParse
	expect(result.iso).toBeInstanceOf(Date);
	expect((result.iso as unknown as Date).getTime()).toBe(testDate.getTime());
});

test.sequential("Date param roundtrip via stargate.execute", async () => {
	const testDate = new Date("2025-06-15T10:30:00.000Z");

	const [error, result] = await stargate.execute("/action/date-echo", {
		params: { date: testDate },
	});

	expect(error).toBeNull();
	expect(result).toBeDefined();
	expect(result!.isDate).toBe(true);
	expect(result!.timestamp).toBe(testDate.getTime());
});
