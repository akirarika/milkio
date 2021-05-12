import _config from "./config";
import _models from "./models";
import _batch$ from "./helpers/batch$";
import _auto$ from "./helpers/auto$";

export const kurimudbConfig = _config;

// model base class
export const Models = _models;

// helper functions
export const batch$ = _batch$;
export const auto$ = _auto$;

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
