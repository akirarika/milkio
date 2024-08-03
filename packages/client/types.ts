export * from "milkio-client";
import { failCode } from "../../src/fail-code";
import type _ApiSchema from "../../generated/api-schema";
export const FailCode = failCode;
export type ApiSchema = typeof _ApiSchema;
export type FailCode = keyof typeof failCode;
export type ExecutePath = keyof ApiSchema["apiMethodsSchema"];
export type Fail<FailCode extends keyof typeof failCode> = {
	code: FailCode;
	message: string;
	data: Parameters<(typeof failCode)[FailCode]>[0];
};
export type ExecuteParams<Path extends keyof ApiSchema["apiMethodsSchema"]> =
	Awaited<
		Parameters<ApiSchema["apiMethodsTypeSchema"][Path]["api"]["action"]>[0]
	>;
export type ExecuteMethodResult<
	Path extends keyof ApiSchema["apiMethodsTypeSchema"],
> = Awaited<
	ReturnType<ApiSchema["apiMethodsTypeSchema"][Path]["api"]["action"]>
>;
export type ExecuteResult<
	Path extends keyof ApiSchema["apiMethodsTypeSchema"],
> =
	| {
			success: true;
			data: Awaited<
				ReturnType<ApiSchema["apiMethodsTypeSchema"][Path]["api"]["action"]>
			>;
	  }
	| { success: false; fail: Fail<keyof typeof failCode> };
