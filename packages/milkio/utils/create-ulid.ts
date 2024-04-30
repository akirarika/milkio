import { monotonicFactory } from "ulidx";

const ulid = monotonicFactory();

export const createUlid = () => ulid();
