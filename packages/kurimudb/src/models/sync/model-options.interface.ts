import { SyncAbstractDriverFactory } from "../..";

export interface ModelOptionsInterface {
  name: string;
  modelType: "keyValue" | "collection";
  ioType: "sync";
  primary: string;
  driver: SyncAbstractDriverFactory | undefined;
  intrinsicTypes: string[] | false;
  [others: string]: unknown;
}
