import chalk from "chalk";
import schema from "../../../generated/api-schema";
import { ExecuteResultFail, type MilkioApp } from "..";
import { handleCatchError } from "../utils/handle-catch-error.ts";

export const executeApiTests = async <Path extends Array<keyof (typeof schema)["apiTestsSchema"]>>(app: MilkioApp, path: Path | string | true | 1 | undefined) => {
	console.log(`${chalk.hex("#81C7D4")(`🧊 test running`)}`);

	let pathArr = [] as Array<string>;
	if (!path || path === "1" || path === 1 || path === true) {
		pathArr = Object.keys(schema.apiTestsSchema) as unknown as Path;
	} else if (typeof path === "string") {
		pathArr = [path] as Path;
	}

	const startedAt = new Date().getTime();
	const apiTestHooks = await import("../../../src/api-test.ts");
	await apiTestHooks.default.onBootstrap();
	const clientPackage = apiTestHooks.default?.client ? (await apiTestHooks.default?.client()) : undefined;
	const results: Array<{ path: string, case: number, fail: boolean, failMessage?: string }> = [];
	console.log(chalk.hex("#0B346E")(`₋₋₋₋₋₋₋₋`));

	if (!clientPackage) {
		console.log(`🚨 For testing purposes, if the client package does not exist, subsequent operations might result in errors.`);
		console.log(`🚨 To disable this warning and ensure the test system runs correctly:`);
		console.log(` - Run: \`bun i packages/client && cd packages/client && bun i milkio-client\``);
		console.log(` - Edit: \`src/api-test.ts\``);
		console.log(` - Add: \`client: () => createClient({ baseUrl: "http://localhost:9000/", memoryStorage: true }),\``);
		console.log(` - The \`createClient\` method is imported from your client package. If you haven't changed the name in \`packages/client/package.json\`, you can use: \`import { createClient } from 'client';\`.`);
	} else {
		let done = false;
		for (let index = 0; index < 160; index++) {
			let response;
			try {
				response = await fetch(typeof clientPackage.options.baseUrl === "string" ? clientPackage.options.baseUrl : await clientPackage.options.baseUrl(), { method: "HEAD" });
			} catch (error: any) {
				if (error?.status && error.status < 500) {
					done = true;
					break;
				}
			}
			if (response?.status && response.status < 500) {
				done = true;
				break;
			}
			await new Promise((resolve) => setTimeout(resolve, 100));
			continue;
		}
		if (!done) {
			console.log(`🚨 The server startup exceeded the maximum waiting time (1600ms).`);
			console.log(`This is likely an error encountered during the startup of the Milkio Server. Please check the 'Milkio Run & Watch' tab in your VS Code terminal panel. This is only a warning, and the tests will continue, but there is a chance they might fail due to network issues.\n`);
		}
	}

	const client = clientPackage ? {
		execute: async (options?: any) => clientPackage!.execute((path as any), options),
		executeOther: async (path: any, options?: any) => clientPackage!.execute((path as any), options),
		executeStream: async (options?: any) => clientPackage!.executeStream((path as any), options),
		executeStreamOther: async (path: any, options?: any) => clientPackage!.executeStream((path as any), options),
	} : undefined;

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
					execute: async (options?: any) => app.execute((path as any), options),
					executeOther: async (path: any, options?: any) => app.execute((path as any), options),
					executeStream: async (options?: any) => app.executeStream((path as any), options),
					executeStreamOther: async (path: any, options?: any) => app.executeStream((path as any), options),
					client,
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
