export * from "./types";
import type ApiSchema from "./project/generated/api-schema";
import { defineMilkioClient } from "milkio-client";
import type { FailCode } from "./types";

export const createClient = defineMilkioClient<typeof ApiSchema, typeof FailCode>([]);
