import type { Api, ExecuteResult, ExecuteOptions, GeneratorGeneric, ExecuteResultSuccess } from "..";
import type schema from "../../../generated/api-schema";
import type apiTestHooks from "../../../src/api-test.ts";

export function defineApiTest<ApiT extends Api>(_api: ApiT, cases: Array<ApiTestCases<ApiT>>) {
	return {
		getCases: () => cases,
		isApiTest: true,
	};
}

export type ApiTestCases<ApiT extends Api> = {
	handler: (
		test: {
			log: (...params: Array<unknown>) => void;
			execute: (options: { params: Parameters<ApiT["action"]>[0], headers?: Record<string, string> } & ExecuteOptions) => Promise<ExecuteResult<Awaited<ReturnType<ApiT["action"]>>>>;
			executeOther: <Path extends keyof (typeof schema)["apiMethodsTypeSchema"], Result extends Awaited<ReturnType<(typeof schema)["apiMethodsTypeSchema"][Path]["api"]["action"]>>>(
				path: Path,
				options: {
					params: Parameters<(typeof schema)["apiMethodsTypeSchema"][Path]["api"]["action"]>[0] | string,
					headers?: Record<string, string>
				} & ExecuteOptions,
			) => Promise<ExecuteResult<Result>>;
			executeStream: (options: { params: Parameters<ApiT["action"]>[0], headers?: Record<string, string> } & ExecuteOptions) => Promise<{
				getResult: () => ExecuteResult<undefined>,
				stream: AsyncGenerator<Awaited<ReturnType<ApiT["action"]>>>
			}>;
			executeStreamOther: <Path extends keyof (typeof schema)["apiMethodsTypeSchema"], Result extends Awaited<ReturnType<(typeof schema)["apiMethodsTypeSchema"][Path]["api"]["action"]>>>(path: Path, options: { params: Parameters<(typeof schema)["apiMethodsTypeSchema"][Path]["api"]["action"]>[0] | string, headers?: Record<string, string> } & ExecuteOptions) => Promise<{
				getResult: () => ExecuteResult<undefined>,
				stream: AsyncGenerator<Result>
			}>;
			client: {
				execute: (options: { params: Parameters<ApiT["action"]>[0], headers?: Record<string, string> } & ExecuteOptions) => Promise<ExecuteResult<Awaited<ReturnType<ApiT["action"]>>>>;
				executeOther: <Path extends keyof (typeof schema)["apiMethodsTypeSchema"], Result extends Awaited<ReturnType<(typeof schema)["apiMethodsTypeSchema"][Path]["api"]["action"]>>>(
					path: Path,
					options: {
						params: Parameters<(typeof schema)["apiMethodsTypeSchema"][Path]["api"]["action"]>[0] | string,
						headers?: Record<string, string>
					} & ExecuteOptions,
				) => Promise<ExecuteResult<Result>>;
				executeStream: (options: { params: Parameters<ApiT["action"]>[0], headers?: Record<string, string> } & ExecuteOptions) => Promise<{
					getResult: () => ExecuteResult<undefined>,
					stream: AsyncGenerator<Awaited<ReturnType<ApiT["action"]>>>
				}>;
				executeStreamOther: <Path extends keyof (typeof schema)["apiMethodsTypeSchema"], Result extends Awaited<ReturnType<(typeof schema)["apiMethodsTypeSchema"][Path]["api"]["action"]>>>(path: Path, options: { params: Parameters<(typeof schema)["apiMethodsTypeSchema"][Path]["api"]["action"]>[0] | string, headers?: Record<string, string> } & ExecuteOptions) => Promise<{
					getResult: () => ExecuteResult<undefined>,
					stream: AsyncGenerator<Result>
				}>;
			}
			randParams: () => Promise<Parameters<ApiT["action"]>[0]>;
			randOtherParams: <Path extends keyof (typeof schema)["apiMethodsTypeSchema"]>(path: Path) => Promise<Parameters<(typeof schema)["apiMethodsTypeSchema"][Path]["api"]["action"]>[0]>;
			reject: (message?: string) => void;
		} & Awaited<ReturnType<(typeof apiTestHooks)["onBefore"]>>,
	) => Promise<void> | void;
	name: string;
	timeout?: number;
};
