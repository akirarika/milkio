import { readFileSync, existsSync, writeFileSync } from 'fs';

const path = "./kurimudb.json"; // TODO: Maybe read it from model?
let data = {};
let loaded = false;

function load(): void {
  if (loaded) {
    return;
  }
  loaded = true;
  if (existsSync(path)) { // TODO: Find a way to use async methods.
    try {
      data = JSON.parse(readFileSync(path).toString());
    } catch (error) {
      throw new Error(`kurimudb-driver-nodejson: Failed to parse ${path}: ${error}`);
    }
  }
}

function save(): void {
  writeFileSync(path, JSON.stringify(data));
}

export class NodeJsonDriver {
    model;
    root: {
      nextid: number,
      data: object,
      seeded?: boolean
    };
  
    constructor(model) {
      this.model = model;
      load();
      this.root = data[this.model.options.name] = data[this.model.options.name] || {
        nextid: 1,
        seeded: false,
        data: {}
      }; 
    }

    insert(value: any, key?: string | number): string | number {
      if (!key) {
        const id = this.root.nextid++;
        key = String(id);
      }
      this.root.data[String(key)] = value;
      save();
      return key;
    }
  
    insertOrUpdate(key: string | number, value: any): void {
      this.insert(value, key);
    }
  
    update(key: string | number, value: any): void {
      this.insert(value, key);
    }
  
    select(key: string | number): any {
      return this.root.data[String(key)];
    }
  
    exists(key: string | number): boolean {
      return String(key) in this.root.data;
    }
  
    delete(key: string | number): void {
      delete this.root.data[String(key)];
      save();
    }
  
    seeding(seeding: Function, model) { // I'm not sure what should this function do. I just emulate what localstorage driver does.
      if (this.root.seeded) {
        return;
      }
      seeding(model);
      this.root.seeded = true;
    }
  
    all() {
      throw new Error(`The nodejson driver cannot use the 'all' method.`); // The same as above.
  
      return [];
    }
  }
  