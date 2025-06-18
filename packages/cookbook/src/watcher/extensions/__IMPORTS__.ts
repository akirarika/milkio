import { configWatcherExtension } from "./config";
import { routeWatcherExtension } from "./route";
import { handlerWatcherExtension } from "./handler";
import { metaWatcherExtension } from "./meta";
import { contextWatcherExtension } from "./context";
import { drizzleWatcherExtension } from "./drizzle";
import { eventWatcherExtension } from "./event";
import type { defineWatcherExtension } from "../extensions";
import { typiaWatcherExtension } from "./typia";
import { codeWatcherExtension } from "./code";

export const imports: Array<ReturnType<typeof defineWatcherExtension>> = [
  // extensions
  routeWatcherExtension,
  handlerWatcherExtension,
  configWatcherExtension,
  drizzleWatcherExtension,
  metaWatcherExtension,
  contextWatcherExtension,
  codeWatcherExtension,
  eventWatcherExtension,
  typiaWatcherExtension,
];

export const indexTs = `// index
import "./declares.d.ts";
import typiaSchema from "./typia-schema.ts";
import routeSchema from "./route-schema.ts";
import handlerSchema from "./handler-schema.ts";
import type { $rejectCode } from "milkio";

export const generated = {
  rejectCode: undefined as unknown as $rejectCode,
  typiaSchema,
  routeSchema,
  handlerSchema,
};
`;
