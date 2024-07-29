import type { ExecuteId, Logger, MilkioHttpResponse, Mixin, ToEmptyObject, Remove$ } from "..";

export type MilkioContext = {
	path: string;
	executeId: ExecuteId;
	headers: Headers;
	logger: Logger;
	/**
	 * Additional information about the request
	 * These are usually only fully implemented when called by an Http server
	 * During testing or when calling between microservices, some or all of the values may be undefined
	 */
	detail: FrameworkHttpDetail;
	step: Steps<{}>['step'];
};

export type FrameworkHttpDetail = {
	path: string;
	executeId: ExecuteId;
	fullurl: URL;
	ip: string;
	request: Request;
	response: MilkioHttpResponse;
};

export type Steps<StageT extends Record<any, any>> = {
	step: StepFunction<StageT>,
	// run: <HandlerT extends (stage: StageT) => Record<any, any> | Promise<Record<any, any>>>(handler: HandlerT) => Promise<Awaited<ReturnType<HandlerT>>>,
	run: () => Promise<Remove$<StageT>>
}

type StepFunction<StageT extends Record<any, any>> = <HandlerT extends ((stage: Readonly<StageT>) => Record<any, any> | Promise<Record<any, any>>) >(handler: HandlerT) => Steps<Mixin<Awaited<StageT>, ToEmptyObject<Awaited<ReturnType<HandlerT>>>>>

export const createStep = () => {
	const stepController = {
		_steps: [] as Array<(stage: any) => Promise<any>>,
		step(handler: (stage: any) => Promise<any>) {
			stepController._steps.push(handler);
			return stepController;
		},
		async run() {
			let stage = {};
			for (const step of stepController._steps) {
				stage = { ...stage, ...(await step(stage)) }
			}
			let result: Record<any, any> = {};
			for (const key in stage) {
				const value = (stage as any)[key];
				if (!key.endsWith('$')) result[key] = value;
			}
			return result;
		}
	}
	return stepController.step as any as Steps<{}>['step'];
};