export abstract class AbstractDriver {
  abstract all(): Array<unknown> | Promise<Array<unknown>>;
  abstract insert(
    value: unknown,
    key?: string | number
  ): string | number | Promise<string | number>;
  abstract insertOrUpdate(
    key: string | number,
    value: unknown
  ): void | Promise<void>;
  abstract update(key: string | number, value: unknown): void | Promise<void>;
  abstract select(key: string | number): unknown | Promise<unknown>;
  abstract exists(key: string | number): boolean | Promise<boolean>;
  abstract delete(key: string | number): void | Promise<void>;
  abstract seeding(sedding: Function, model): void;
}
