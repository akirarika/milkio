import { Cookie } from "./cookie";
import { Db } from "./db";
import { Local } from "./local";
import { Memory } from "./memory";

export { auto$, batch$, kurimudbConfig } from "kurimudb";

export const db = new Db();
export const local = new Local();
export const memory = new Memory();
export const cookie = new Cookie();
