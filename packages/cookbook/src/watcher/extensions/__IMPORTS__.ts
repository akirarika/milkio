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
import { seedWatcherExtension } from "./seed";

export const imports: Array<ReturnType<typeof defineWatcherExtension>> = [
    // extensions
    // drizzle must run BEFORE route: action files import drizzle-schema,
    // so drizzle-schema.ts must be generated before typia runs in route
    drizzleWatcherExtension,
    routeWatcherExtension,
    handlerWatcherExtension,
    configWatcherExtension,
    metaWatcherExtension,
    contextWatcherExtension,
    codeWatcherExtension,
    eventWatcherExtension,
    typiaWatcherExtension,
    seedWatcherExtension,
];

export const indexTs = `// index
import type { MilkioMeta, MilkioContext, MilkioRejectCode, MilkioEvents } from "./declares.ts";
import typiaSchema from "./typia-schema.ts";
import routeSchema from "./route-schema.ts";
import handlerSchema from "./handler-schema.ts";


export const generated = {
  meta: undefined as unknown as MilkioMeta,
  context: undefined as unknown as MilkioContext,
  rejectCode: undefined as unknown as MilkioRejectCode,
  events: undefined as unknown as MilkioEvents,
  typiaSchema,
  routeSchema,
  handlerSchema,
};
`;
