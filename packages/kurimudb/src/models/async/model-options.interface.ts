import { SyncAbstractDriverFactory, AsyncAbstractDriverFactory } from "../..";

export interface ModelOptionsInterface {
  name: string;
  modelType: "keyValue" | "collection";
  ioType: "async";
  primary: string;
  intrinsicTypes: string[] | false;
  driver?: SyncAbstractDriverFactory | AsyncAbstractDriverFactory;
  autoIncrementHandler?: (
    options: ModelOptionsInterface
  ) => string | Promise<string>;
  [others: string]: unknown;
}
