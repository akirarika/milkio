export * from "./types";
import { failCode } from "../../src/fail-code";
import type ApiSchema from "../../generated/api-schema";
import { defineMilkioClient, defineMiddleware } from "milkio-client";

export const createClient = defineMilkioClient<
	typeof ApiSchema,
	typeof failCode
>([
	//
]);

export const FailCode = failCode;
