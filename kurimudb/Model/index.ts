import { Collection, Table } from "dexie";
import { merge, Subject, BehaviorSubject, throwError } from "rxjs";
import Connection from "../Connection";
import Cache from "./Cache";
import Data from "./Data";
import Database from "./Database";

export default class Model {
  name;
  primary;
  primaryType;

  _connection: Connection | false;
  _database: Database;
  _cache: Cache;
  data: Data;

  inserted$ = new Subject();
  deleted$ = new Subject();
  updated$ = new Subject();
  changed$ = merge(this.inserted$, this.deleted$, this.updated$);
  $ = new BehaviorSubject({});

  seeding;

  constructor(
    connection: Connection | false,
    [primary, primaryType]: [string, string]
  ) {
    this.name = this.constructor.name;
    this.primary = primary;
    this.primaryType = primaryType;

    if (!this.name) throw new Error(`'name' not found.`);
    if (connection && !connection.getConnection()[this.name])
      throw new Error(
        `Table not found. Did you add this table '${this.name}' to the migrations?`
      );

    this._connection = connection;
    this._database = new Database(this);
    this._cache = new Cache(this);
    this.data = new Data(this);

    this.changed$.subscribe((d: any) => this.$.next(d));

    this._seeding();
  }

  async all() {
    if (!this._connection) return this._cache.all();
    return this.getResults(this.query());
  }

  query(): Table {
    return this._database.query();
  }

  async getResults(query: Collection | Table, resultProt = {}) {
    if (!this._connection)
      throw new Error(
        `This function can only be used when you have Collection`
      );
    let querys = await query.toArray();
    if (!(querys instanceof Array))
      throw new Error(
        `The query result is not a single object. If it's an array, please use 'getresult' instead.`
      );
    for (const item of querys) {
      const key = item[this.primary];
      if (this._cache.has(key)) resultProt[key] = this._cache.get(key);
      else {
        resultProt[key] = this._database.decode(item);
        this._cache.add(key, resultProt[key]);
      }
    }
    return resultProt;
  }

  async getResult(
    query: Promise<Record<string | number, any>>,
    resultProt = {}
  ) {
    if (!this._connection)
      throw new Error(
        `This function can only be used when you have Collection`
      );
    if (!this._isPlainObject(await query))
      throw new Error(
        `The query result is not a single array. If it's an object, please use 'getresults' instead.`
      );
    const item = await query;
    const key = item[this.primary];
    if (this._cache.has(key)) resultProt[key] = this._cache.get(key);
    else {
      resultProt[key] = this._database.decode(item);
      this._cache.add(key, resultProt[key]);
    }
    return resultProt;
  }

  async has(key) {
    key = this.checkPrimary(key);
    if (this._cache.has(key)) return true;
    if (this._connection) return this._database.has(key);
    else return false;
  }

  checkPrimary(key) {
    if ("number" === this.primaryType && !isNaN(Number(key)))
      return Number(key);
    if (this.primaryType !== typeof key)
      throw new Error(
        `The model primary type needs to be ${
          this.primaryType
        }, not ${typeof key}`
      );
    return key;
  }

  async _seeding() {
    if (!this.seeding) return;
    if (!this._connection) return this.seeding(this.data);
    const table = this._connection.getConnection()["__Kurimudb"];
    if (await table.get("is_seeded")) return;
    this.seeding(this.data);
    await table.add({
      key: "is_seeded",
      value: "true",
    });
  }

  _humpToLine(str: string) {
    return str
      .replace(/([A-Z])/g, "_$1")
      .toLowerCase()
      .replace(/^_/, "");
  }

  _isPlainObject(obj) {
    if (typeof obj !== "object" || obj === null) return false;

    let proto = obj;
    while (Object.getPrototypeOf(proto) !== null) {
      proto = Object.getPrototypeOf(proto);
    }
    // proto = null
    return Object.getPrototypeOf(obj) === proto;
  }
}
