import type { PGlite } from "@electric-sql/pglite";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import type * as schema from "../../.milkio/drizzle-schema.ts";

export interface _ {
    say(): string;
    db: PgliteDatabase<typeof schema> & {
        $client: PGlite;
    };
}
