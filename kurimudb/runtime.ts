interface RuntimeInterface {
  readItemDependencies: Array<any>;
  collectingReadItemDependencies: boolean;
}

const runtime: RuntimeInterface = {
  readItemDependencies: [],
  collectingReadItemDependencies: false,
};

export default runtime;
