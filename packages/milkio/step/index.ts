export interface Steps<StageT extends Record<any, any>> {
  step: StepFunction<StageT>;
  run: () => Promise<Remove_<StageT>>;
}

type Remove_<T> = {
  [K in keyof T as K extends `_${string}` ? never : K]: T[K];
};

type ToEmptyObject<T> = T extends undefined | null | never ? {} : T extends object ? T : {};

export type StepFunction<StageT extends Record<any, any>> = <HandlerT extends (stage: Readonly<StageT>) => Record<any, any> | Promise<Record<any, any>>>(handler: HandlerT) => Steps<Awaited<StageT> & ToEmptyObject<Awaited<ReturnType<HandlerT>>>>;

export function createStep(): Steps<{}> {
  const stepController = {
    $milkioType: "step",
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
      const result: Record<any, any> = {};
      for (const key in stage) {
        const value = (stage as any)[key];
        if (!key.startsWith("_")) result[key] = value;
      }
      return result;
    },
  };
  return stepController as any as Steps<{}>;
}
