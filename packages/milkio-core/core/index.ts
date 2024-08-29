export type MilkioOptions = {
  port: {
    app: number;
    develop: number | "disabled";
  };
  argv: Array<string>;
};

export const defineMilkio = async (options: MilkioOptions): Promise<Milkio> => {
  return {
    options,
    port: options.port.app,
  };
};

export type Milkio = {
  options: MilkioOptions;
  port: number;
};
