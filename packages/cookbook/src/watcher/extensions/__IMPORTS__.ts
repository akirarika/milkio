import { routeValidateWatcherExtension } from "./route-validate";
import { configWatcherExtension } from "./config";
import { routeGenerateWatcherExtension } from "./route-generate";
import { routeTypiaWatcherExtension } from "./route-typia";
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
    // route-validate must run FIRST: validates that every action/stream file
    // has Params, Result types and handler in the correct order. This runs
    // before any other extension so issues are caught immediately.
    routeValidateWatcherExtension,
    // drizzle must run BEFORE route: action files import drizzle-schema,
    // so drizzle-schema.ts must be generated before typia runs
    drizzleWatcherExtension,
    // route-generate: write generated route schema files + preliminary route-schema.ts
    routeGenerateWatcherExtension,
    // route-typia: run typia generate on all generated route schemas
    // (uses temp tsconfig excluding test files to prevent tsc errors from test files)
    routeTypiaWatcherExtension,
    // route: generate final route-schema.ts from typia output
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
