export { default as kurimudbConfig } from "./config";
export { default as auto$ } from "./helpers/auto$";
export { default as batch$ } from "./helpers/batch$";
export { default as Models } from "./models";

// interfaces
export interface ModelOptionsInterface {
  name?: string;
  type?: "string" | "number";
  modelType?: "keyValue" | "collection";
  primary?: string;
  driver?: any;
  methods?: Record<string, any>;
  intrinsicTypes?: Array<string> | false;
  async?: boolean;
  [others: string]: any;
}

export interface PersistenceInterface {
  all(): Array<any> | Promise<Array<any>>;
  insert(
    value: any,
    key?: string | number
  ): string | number | Promise<string | number>;
  insertOrUpdate(key: string | number, value: any): void | Promise<void>;
  update(key: string | number, value: any): void | Promise<void>;
  select(key: string | number): any | Promise<any>;
  exists(key: string | number): boolean | Promise<boolean>;
  delete(key: string | number): void | Promise<void>;
  seeding(sedding: Function, model): void;
}
