import { SyncAbstractDriverFactory, AsyncAbstractDriverFactory } from "../..";

export interface ModelOptionsInterface {
  name: string;
  modelType: "keyValue" | "collection";
  ioType: "async";
  primary: string;
  driver: SyncAbstractDriverFactory | AsyncAbstractDriverFactory | undefined;
  intrinsicTypes: string[] | false;
  [others: string]: unknown;
}
