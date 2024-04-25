import typia from "typia";
import { _validate, type ExecuteResultFail, type ExecuteResultSuccess } from "milkio";
import { type TSONEncode } from "@southern-aurora/tson";
import type * as cookbook from '../../../src/apps/cookbook';

type ParamsT = Parameters<typeof cookbook['api']['action']>[0];
export const validateParams = async (params: any) => typia.misc.validatePrune<ParamsT>(params);
type ResultsT = Awaited<ReturnType<typeof cookbook['api']['action']>>;
export const validateResults = async (results: any) => { _validate(typia.validate<TSONEncode<ExecuteResultSuccess<ResultsT> | ExecuteResultFail>>(results)); return typia.json.stringify<TSONEncode<ExecuteResultSuccess<ResultsT> | ExecuteResultFail>>(results); };
export const randParams = async () => typia.random<ParamsT>();