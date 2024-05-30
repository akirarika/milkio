import { type MiddlewareOptions, _middlewares, MiddlewareEvent } from "./middleware";
import schema from "../../../generated/api-schema";
import { runtime } from "..";
import { createUlid } from "../utils/create-ulid";
import { _validate } from "./validate";
import { _execute, _call, _executeToJson, _executeStream } from "./execute";

export type MilkioAppOptions = {
	/**
	 * bootstraps
	 * @description
	 * When Milkio is launched, all methods in this array will run **in parallel**.
	 */
	bootstraps?: () => Array<
		/* This type is long, and its intention is to prevent someone from forgetting to add parentheses when adding bootstraps. Therefore, it allows all types except methods */ Promise<unknown> | void | string | number | boolean | null | undefined | Record<string | number | symbol, unknown> | Array<unknown>
	>;
	/**
	 * middlewares
	 * @description
	 * When Milkio is launched, the closer it is to the front of the array, the more it is on the outer layer of the "onion".
	 */
	middlewares?: () => Array<MiddlewareOptions>;
	/**
	 * maxRunningTime (minutes)
	 * @description
	 * When the function runs for a long time, it is possible that the memory will continuously expand (not necessarily due to memory leaks, but also possibly due to having a large number of routes).
	 * Set the maximum running time (in minutes). When milkio's running time reaches this value, terminate the process and automatically restart it from outside (K8S or other means).
	 */
	enableMaxRunningTimeoutLimit?: number | null | undefined;
};

export async function createMilkioApp(MilkioAppOptions: MilkioAppOptions = {}) {
	if (MilkioAppOptions.enableMaxRunningTimeoutLimit && MilkioAppOptions.enableMaxRunningTimeoutLimit >= 1) {
		setTimeout(
			() => {
				throw new Error('Milkio reached the limit of "maxRunningTimeout" in the options and automatically exited.');
			},
			MilkioAppOptions.enableMaxRunningTimeoutLimit * 60 * 1000,
		);
		runtime.maxRunningTimeout.enable = true;
	}

	const MilkioApp = {
		randParams: _randParams,
		execute: _execute,
		executeToJson: _executeToJson,
		executeStream: _executeStream,
		_call,
	};

	if (MilkioAppOptions.bootstraps) {
		await Promise.all(MilkioAppOptions.bootstraps());
	}

	if (MilkioAppOptions.middlewares) {
		MiddlewareEvent.define("bootstrap", (a, b) => a.index - b.index);
		MiddlewareEvent.define("beforeExecute", (a, b) => a.index - b.index);
		MiddlewareEvent.define("afterExecute", (a, b) => b.index - a.index);
		MiddlewareEvent.define("afterHttpRequest", (a, b) => a.index - b.index);
		MiddlewareEvent.define("beforeHttpResponse", (a, b) => b.index - a.index);
		MiddlewareEvent.define("httpNotFound", (a, b) => a.index - b.index);

		const middlewares = MilkioAppOptions.middlewares();

		for (let index = 0; index < middlewares.length; index++) {
			const middlewareOptions = middlewares[index];
			for (const name in middlewareOptions) {
				let middleware = _middlewares.get(name);
				if (middleware === undefined) {
					middleware = [];
					_middlewares.set(name, middleware);
				}
				const id = createUlid();
				middleware.push({ id, index, middleware: middlewareOptions[name] });
			}
		}
		MiddlewareEvent._sort();

		await MiddlewareEvent.handle("bootstrap", [MilkioApp]);
	}

	return MilkioApp;
}

export async function _randParams<Path extends keyof (typeof schema)["apiMethodsTypeSchema"]>(path: Path): Promise<Parameters<(typeof schema)["apiMethodsTypeSchema"][Path]["api"]["action"]>[0]> {
	return await (await schema.apiValidator.validate[path]()).randParams();
}
