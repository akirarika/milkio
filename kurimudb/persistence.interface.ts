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
