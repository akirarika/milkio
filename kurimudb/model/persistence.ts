import Model from ".";
import { PersistenceInterface } from "..";

export default class Persistence<T> {
  model: Model<T>;
  persistence: PersistenceInterface;
  async: boolean;

  constructor(model: Model<T>) {
    this.model = model;
    this.persistence = new this.model.config.drivers.persistence(
      this.model.config.name,
      this.model.primary,
      this.model.config.drivers.persistenceInject
    );
    this.async = Boolean(this.persistence?.async);
  }

  insert(value: any, key?: string | number) {
    if (this.persistence.encode) value = this.model.encode(value, void 0);
    return this.persistence.insert(value, key);
  }

  insertOrUpdate(key: string | number, value: any) {
    if (this.persistence.encode) value = this.model.encode(value, key);
    return this.persistence.insertOrUpdate(key, value);
  }

  update(key: string | number, value: any) {
    if (this.persistence.encode) value = this.model.encode(value, key);
    return this.persistence.update(key, value);
  }

  select(key: string | number) {
    return this.persistence.select(key);
  }

  exists(key: string | number) {
    return this.persistence.exists(key);
  }

  delete(key: string | number): void {
    this.persistence.delete(key);
  }

  seeding(seeding: Function, model: Model<T>): void {
    this.persistence.seeding(seeding, model);
  }

  query() {
    if (!this.persistence.query)
      throw new Error(`This driver does not implement the query function.`);
    return this.persistence.query();
  }

  all() {
    return this.persistence.all();
  }
}
