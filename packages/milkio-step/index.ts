export type Steps<StageT extends Record<any, any>> = {
	step: StepFunction<StageT>;
	run: () => Promise<Remove$<StageT>>;
	runSync: () => Remove$<StageT>;
};
type StepFunction<StageT extends Record<any, any>> = <HandlerT extends (stage: Readonly<StageT>) => Record<any, any> | Promise<Record<any, any>>>(handler: HandlerT) => Steps<Mixin<Awaited<StageT>, ToEmptyObject<Awaited<ReturnType<HandlerT>>>>>;

type Remove$<T> = {
	[K in keyof T as K extends `$${string}` ? never : K]: T[K];
};

type Mixin<T, U> = U & Omit<T, keyof U>;

type ToEmptyObject<T> = T extends undefined | null | never ? {} : T extends object ? T : {};

export const createStep = (() => {
	const stepController = {
		_steps: [] as Array<(stage: any) => Promise<any>>,
		step(handler: (stage: any) => Promise<any>) {
			stepController._steps.push(handler);
			return stepController;
		},
		async run() {
			let stage = {};
			for (const step of stepController._steps) {
				stage = { ...stage, ...(await step(stage)) };
			}
			let result: Record<any, any> = {};
			for (const key in stage) {
				const value = (stage as any)[key];
				if (!key.startsWith("$")) result[key] = value;
			}
			return result;
		},
		runSync() {
			let stage = {};
			for (const step of stepController._steps) {
				stage = { ...stage, ...step(stage) };
			}
			let result: Record<any, any> = {};
			for (const key in stage) {
				const value = (stage as any)[key];
				if (!key.startsWith("$")) result[key] = value;
			}
			return result;
		},
	};

	return { step: stepController.step };
}) as any as () => { step: Steps<{}>["step"] };
