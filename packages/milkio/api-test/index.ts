import schema from "../../../generated/api-schema";
import { ExecuteResultFail, type MilkioApp } from "..";
import { cwd } from "node:process";
import chalk from "chalk";
import { handleCatchError } from "../utils/handle-catch-error.ts";

export const executeApiTests = async <Path extends Array<keyof (typeof schema)["apiTestsSchema"]>>(app: MilkioApp, path: Path | string | true | 1 | undefined) => {
	console.log(`${chalk.hex("#81C7D4")(`🧊 test running on`)} ${chalk.hex("#999A9E").underline(cwd())}`);

	let pathArr = [] as Array<string>;
	if (!path || path === "1" || path === 1 || path === true) {
		pathArr = Object.keys(schema.apiTestsSchema) as unknown as Path;
	} else if (typeof path === "string") {
		pathArr = [path] as Path;
	}

	const startedAt = new Date().getTime();
	const apiTestHooks = await import("../../../src/api-test.ts");
	await apiTestHooks.default.onBootstrap();
	const results: Array<{ path: string, case: number, fail: boolean, failMessage?: string }> = [];
	console.log(chalk.hex("#0B346E")(`₋₋₋₋₋₋₋₋`));

	for (const pathRaw of pathArr) {
		let path = pathRaw.replaceAll("\\", "/");
		if (path.startsWith("/")) path = path.slice(1) as Path[number];

		// @ts-ignore
		const module = await schema.apiTestsSchema[path]().module;
		const cases = module.test.getCases();
		let i = 0;
		for (const cs of cases) {
			++i;
			const csStartedAt = new Date().getTime();
			let fail = false;
			let failMessage: string | undefined = undefined;
			try {
				await cs.handler({
					...((await apiTestHooks.default.onBefore()) ?? {}),
					log: (...args: Array<unknown>) => console.log(...args),
					// @ts-ignore
					execute: async (options?: any) => app.execute((path as any), options),
					executeOther: async (path: any, options?: any) => app.execute((path as any), options),
					executeStream: async (options?: any) => app.executeStream((path as any), options),
					randParams: () => app.randParams(path as any),
					randOtherParams: (path: any) => app.randParams(path),
					reject: (message?: string) => {
						fail = true;
						failMessage = message;
					},
				});
			} catch (e: any) {
				const response = handleCatchError(e, 'no-execute-id') as ExecuteResultFail;
				fail = true;
				failMessage = response.fail.message;
			}
			if (fail) {
				console.log(`${chalk.hex("#D75455")(`\nrejected`)}${chalk.hex("#999A9E")(` · ${cs.name} | path: src/apps/${path as string}.ts | case: ${i} | time: ${new Date().getTime() - csStartedAt}ms`)}`);
				console.log(chalk.hex("#999A9E")(failMessage ?? "Test not satisfied"));
			} else {
				console.log(`${chalk.hex("#1B813E")(`directed`)}${chalk.hex("#999A9E")(` · ${cs.name} | path: src/apps/${path as string}.ts | case: ${i} | time: ${new Date().getTime() - csStartedAt}ms`)}`);
			}
			results.push({ path, case: i, fail, failMessage });
			console.log(chalk.hex("#0B346E")(`₋₋₋₋₋₋₋₋`));
			await new Promise(resolve => setTimeout(resolve, 64));
		}
	}

	const endedAt = new Date().getTime();

	const failTotal = results.filter(r => r.fail).length;
	const passTotal = results.length - failTotal;

	console.log("");
	if (failTotal === 0) console.log(chalk.hex("#1B813E")(`🥳 all tests ${chalk.hex("#1B813E")(`passed`)} ${chalk.hex("#999A9E")(`🌟 milkio testing took ${((endedAt - startedAt) / 1000).toFixed(2)}s\n`)}`));
	else console.log(chalk.hex("#999A9E")(`🤗️️ ${failTotal} test${failTotal > 1 ? "s" : ""} ${chalk.hex("#D75455")(`failed`)}${passTotal > 0 ? `, and ${results.length - failTotal} ${chalk.hex("#1B813E")(`passed`)}` : ''} ${chalk.hex("#999A9E")(`🌟 milkio testing took ${((endedAt - startedAt) / 1000).toFixed(2)}s`)}`));
};
