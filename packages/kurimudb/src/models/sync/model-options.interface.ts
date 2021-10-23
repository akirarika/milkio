import { SyncAbstractDriverFactory } from "../..";

export interface ModelOptionsInterface {
  name: string;
  modelType: "keyValue" | "collection";
  ioType: "sync";
  primary: string;
  intrinsicTypes: string[] | false;
  driver?: SyncAbstractDriverFactory;
  autoIncrementHandler?: (options: ModelOptionsInterface) => string;
  [others: string]: unknown;
}
