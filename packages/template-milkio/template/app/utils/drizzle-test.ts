import { drizzle } from 'drizzle-orm/mysql2';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import type { MySql2Database } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { sql } from 'drizzle-orm';
import { TEST_DATABASE_PREFIX, withTestDatabase } from '@milkio/drizzle';
import type { CleanDatabaseHook } from '@milkio/astra';
import * as schema from '../../.milkio/drizzle-schema.ts';
import { executeSeed } from '../../.milkio/seed.ts';
import { testDbState } from './test-state.ts';

// 本文件是「测试数据库基建」样板代码：建库、完整迁移、seed、清库、删库都在这里，
// 全部由你掌控，可按项目实际方言（mysql/pg/sqlite）自由修改。

/** 建一个 admin 连接（不带库名），用于 CREATE / DROP DATABASE。 */
async function createAdminConnection(baseUrl: string) {
  const url = new URL(baseUrl);
  url.pathname = '/';
  return mysql.createConnection({ uri: url.toString() });
}

/** 删除上一次测试遗留的所有随机测试库。 */
export async function dropAllTestDatabases(baseUrl: string) {
  const admin = await createAdminConnection(baseUrl);
  try {
    const [rows] = await admin.query(`SHOW DATABASES LIKE '${TEST_DATABASE_PREFIX}_%'`);
    for (const row of rows as Array<Record<string, string>>) {
      const name = Object.values(row)[0];
      await admin.query(`DROP DATABASE IF EXISTS \`${name}\``);
    }
  } finally {
    await admin.end();
  }
}

/** 创建数据库（IF NOT EXISTS）。 */
export async function ensureDatabase(baseUrl: string, databaseId: string) {
  const admin = await createAdminConnection(baseUrl);
  try {
    await admin.query(`CREATE DATABASE IF NOT EXISTS \`${databaseId}\``);
  } finally {
    await admin.end();
  }
}

/** 清空指定库中的所有业务表（跳过 drizzle 迁移表）。 */
async function truncateAll(db: any) {
  const tables = (await db.execute(sql`SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE();`))[0] as unknown as Array<any>;
  await db.execute(sql`SET FOREIGN_KEY_CHECKS = 0;`);
  for (const table of tables) {
    if (!table.TABLE_NAME.startsWith('__drizzle_migrations')) {
      await db.execute(sql.raw(`TRUNCATE TABLE \`${table.TABLE_NAME}\`;`));
    }
  }
  await db.execute(sql`SET FOREIGN_KEY_CHECKS = 1;`);
}

/** 当前随机测试库的完整连接 URL（cleanDatabase 之后可用）。 */
export function getCurrentTestDbUrl(baseUrl: string): string {
  if (!testDbState.databaseId) throw new Error('No active test database. Call world.cleanDatabase() first.');
  return withTestDatabase(baseUrl, testDbState.databaseId);
}

/**
 * 跟随当前随机测试库的直连 db。cleanDatabase 每次切库都会重建底层连接，
 * 测试文件直接 import 这个 db 使用即可，无需关心当前库名。
 */
export const db = new Proxy({} as Record<PropertyKey, unknown>, {
  get: (_, prop) => {
    const target = testDbState.db;
    if (!target) throw new Error('No active test database. Call world.cleanDatabase() before using db.');
    const value = Reflect.get(target, prop);
    return typeof value === 'function' ? value.bind(target) : value;
  },
}) as unknown as MySql2Database<typeof schema>;

/**
 * astra 的 cleanDatabase 钩子：每次显式调用 world.cleanDatabase() 都会
 * 生成一个全新随机库并切换到这里。该钩子负责建库、完整迁移、seed，
 * 并把当前库状态写入 testDbState 供测试文件直连。
 * 这是样板实现，你可以按需修改（换方言、跳过 seed、控制迁移目录等）。
 */
export function drizzleCleanHook(options: {
  baseUrl: () => string | Promise<string>;
  migrationsFolder: string;
}): CleanDatabaseHook {
  return async ({ databaseId }) => {
    const baseUrl = await options.baseUrl();
    await ensureDatabase(baseUrl, databaseId);

    const url = withTestDatabase(baseUrl, databaseId);
    const connection = await mysql.createConnection({ uri: url, timezone: '+00:00' });
    await connection.query("SET time_zone = '+00:00'");
    const db = drizzle(connection, { schema, mode: 'default' });

    await migrate(db, { migrationsFolder: options.migrationsFolder });
    await truncateAll(db);
    await db.transaction(async (tx) => executeSeed({ db: tx }));

    // 切换到新库：关闭上一个测试库的连接，避免连接数随 cleanDatabase 次数膨胀
    const previous = testDbState.connection;
    testDbState.databaseId = databaseId;
    testDbState.db = db;
    testDbState.connection = connection;
    if (previous) await previous.end().catch(() => {});
  };
}
