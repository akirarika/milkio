interface RuntimeInterface {
  readItemDependencies: Array<any>;
  collectingReadItemDependencies: boolean;
}

export const runtime: RuntimeInterface = {
  readItemDependencies: [],
  collectingReadItemDependencies: false,
};
