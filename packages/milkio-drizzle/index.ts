import { sql } from "drizzle-orm";

export const DBCleaner = {
	tables: [] as string[],
	addTable(name: string) {
		DBCleaner.tables.push(name);
	},
	async clean<DrizzleT extends { execute: (args: any) => any }>(drizzle: DrizzleT) {
		let queries = "";
		for (const table of DBCleaner.tables) queries += `DROP TABLE IF EXISTS \`${table};\``;
		await drizzle.execute(sql.raw(queries));
	},
};

export type DB<Table extends { $inferInsert: Record<string, unknown> }> = Table["$inferInsert"];
export type DBInsert<Table extends { $inferInsert: Record<string, unknown> }> = Table["$inferInsert"];
export type DBSelect<Table extends { $inferSelect: Record<string, unknown> }> = Table["$inferSelect"];
export type DBPartial<Table extends { $inferSelect: Record<string, unknown> }> = Partial<Table["$inferSelect"]>;
export type DBReplace<Table extends { $inferSelect: Record<string, unknown> }, Replace extends Partial<Record<keyof Table["$inferSelect"], unknown>> = {}> = Replace & Omit<Table["$inferSelect"], keyof Replace>;
export type DBOmit<Table extends { $inferSelect: Record<string, unknown> }, K extends string> = Omit<Table["$inferSelect"], K>;
