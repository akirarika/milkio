import _config from './config';
import _models from './models';
import _batch$ from './helpers/batch$';

export const kurimudbConfig = _config;

// model base class
export const Models = _models;

// helper functions
export const batch$ = _batch$;

// interfaces
export interface ModelOptionsInterface {
  name: string;
  type: 'string' | 'number';
  primary?: string;
  driver?: any;
  methods?: Record<string, any>;
  intrinsicTypes?: Array<string> | false;
}

export interface PersistenceInterface {
  all(): Array<any> | Promise<Array<any>>;
  insert(value: any, key?: string | number): string | number | Promise<string | number>;
  insertOrUpdate(key: string | number, value: any): void | Promise<void>;
  update(key: string | number, value: any): void | Promise<void>;
  select(key: string | number): any | Promise<any>;
  exists(key: string | number): boolean | Promise<boolean>;
  delete(key: string | number): void | Promise<void>;
  seeding(sedding: Function, model): void;
}
