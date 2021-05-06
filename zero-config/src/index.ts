import {
  kurimudbConfig as _kurimudbConfig,
  auto$ as _auto$,
  batch$ as _batch$,
} from "kurimudb";
import _db from "./db";
import _local from "./local";
import _memory from "./memory";
import _cookie from "./cookie";

export const kurimudbConfig = _kurimudbConfig;

export const auto$ = _auto$;
export const batch$ = _batch$;

export const db = _db;
export const local = _local;
export const memory = _memory;
export const cookie = _cookie;
