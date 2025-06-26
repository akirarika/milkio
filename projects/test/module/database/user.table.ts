import { pgTable, serial, text } from "drizzle-orm/pg-core";

export const userTable = pgTable("user", {
  id: serial().primaryKey(),
  name: text(),
  email: text().unique(),
});
