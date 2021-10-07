import { SyncAbstractDriver } from "../drivers/sync-abstract-driver.class";

export interface ModelOptionsInterface {
  name: string;
  modelType?: "keyValue" | "collection";
  ioType?: "sync" | "async";
  primary?: string;
  driver?: SyncAbstractDriver;
  intrinsicTypes?: string[] | false;
  [others: string]: unknown;
}
