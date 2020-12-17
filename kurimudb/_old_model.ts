// import database from '@/models/database';
// import Dexie, { Table } from "dexie";
// import Connection from './Connection';

// let that;

// export default class Model {
//     name: string;
//     options: object;

//     connection: Dexie;
//     table: Table;
//     primary: string;
//     primaryType: string;
//     isPersistence: boolean;

//     value: Record<string | number, any> = {};
//     publicFunc = ['has', 'methods'];

//     constructor(database: Connection, [name, primary, primaryType, isPersistence]: [string, string, string, boolean], options: Record<string, any>) {
//         if ('number' !== primaryType && 'string' !== primaryType) throw new Error(`'primarytype' must be 'string' or 'number'.`);
//         this.name = name;
//         this.options = options;

//         this._connection = database.getConnection();
//         this.table = this._connection[this.name];
//         this.primary = primary;
//         this.primaryType = primaryType;
//         this.isPersistence = isPersistence;

//         if (!this.name) throw new Error(`'name' not found.`);
//         if (!this.table) throw new Error(`Table not found. Did you add this table '${this.name}' to the migration?`);

//         return new Proxy(this, this.handler);
//     }

//     handler = {
//         get: (target: Model, key, receiver) => {
//             if (0 <= target.publicFunc.indexOf(key)) {
//                 that = target;
//                 return target[key];
//             }

//             return new Promise(async (resolve) => {
//                 target.checkParams(target, key);

//                 let result = target.value[key];
//                 if (void 0 === result || null === result) {
//                     result = await target.indexeddbHandler.get(target, key, receiver);
//                     if (result && "__value__" in result) result = result["__value__"];
//                 }

//                 return resolve(result);
//             });
//         },
//         set: (target: Model, key, value, proxy) => {
//             target.checkParams(target, key);

//             target.value[key] = value;
//             if (this.isPersistence) target.indexeddbHandler.set(target, key, value, proxy);

//             return true;
//         },
//         deleteProperty: (target: Model, key) => {
//             target.checkParams(target, key);

//             delete target.value[key];

//             if (this.isPersistence) target.indexeddbHandler.deleteProperty(target, key);

//             return true;
//         },
//     }

//     async has(key) {
//         that.checkParams(that, key);
//         if (key in that.value) return true;

//         return await that.indexeddbHandler.has(that, key);
//     }

//     methods(name, ...args) {
//         return that.options.methods[name](this, ...args);
//     }

//     private indexeddbHandler = {
//         get: async (target: Model, key, receiver) => {
//             return await target.table.get(key);
//         },
//         set: async (target: Model, key, value, proxy) => {
//             if ('function' !== typeof value || 'object' !== typeof value) value = { "__value__": value }
//             value[target.primary] = key;
//             return target.table.put(value);
//         },
//         deleteProperty: async (target: Model, key) => {
//             await target.table.delete(key);
//         },
//         has: async (target: Model, key) => {
//             return !!await target.table.where(target.primary).equals(key).count();
//         },
//     }

//     private humpToLine(string: string) {
//         return string.replace(/([A-Z])/g, "_$1").toLowerCase().replace(/^_/, "");
//     }

//     private checkParams(target: Model, key) {
//         if (target.primaryType !== (typeof key)) throw new Error(`The model primary type needs to be ${target.primaryType}, not ${typeof key}`);
//     }
// }