import { drizzle } from 'drizzle-orm/mysql2';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import type { MySql2Database } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { TEST_DATABASE_PREFIX, withTestDatabase } from '@milkio/drizzle';
import type { CleanDatabaseHook } from '@milkio/astra';
import * as schema from '../../.milkio/drizzle-schema.ts';
import { executeSeed } from '../../.milkio/seed.ts';
import { testDbState } from './test-state.ts';

// 本文件是「测试数据库基建」样板代码：建库、迁移、seed、清库、删库都在这里，
// 全部由你掌控，可按项目实际方言（mysql/pg/sqlite）自由修改。
//
// 「黄金库」方案：完整迁移（几十个迁移文件）只需要跑一次，放在 vitest
// globalSetup 里执行；之后每个 cleanDatabase 直接克隆黄金库的 DDL
// （CREATE TABLE ... LIKE）+ seed，几秒内即可准备好一个全新随机测试库。
// 如果单次迁移足够快，也可以改回每次 cleanDatabase 都完整迁移。

/** 黄金库名：完整迁移只跑一次，所有测试库都从它克隆。 */
export const GOLDEN_DATABASE_NAME = 'milkio_golden';

const GOLDEN_LOCK_NAME = 'milkio_golden_migration';

let goldenPromise: Promise<void> | null = null;

// drizzleCleanHook 自己维护「上一个测试库」，不依赖 testDbState：
// redisCleanHook 与 drizzleCleanHook 并行执行，且 redis 钩子也会写
// testDbState.databaseId（新值），并行时序下从 testDbState 读到的
// "上一个" 实际上是当前值，会导致旧库永远不会被删除。
let lastDatabaseId: string | null = null;
let lastConnection: { end: () => Promise<void> } | null = null;

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

/**
 * 确保黄金库存在且已完成完整迁移。幂等：
 * - 进程内用模块级 promise 缓存，只会真正执行一次；
 * - 跨进程（vitest 多 worker）用 MySQL GET_LOCK 串行化；
 * - force=true 时先删后建（globalSetup 每次运行调用，保证 schema 最新）。
 */
export function ensureGoldenDatabase(options: { baseUrl: string; migrationsFolder: string; force?: boolean }): Promise<void> {
  if (!options.force && goldenPromise) return goldenPromise;
  goldenPromise = ensureGoldenDatabaseInner(options);
  return goldenPromise;
}

async function ensureGoldenDatabaseInner({ baseUrl, migrationsFolder, force }: { baseUrl: string; migrationsFolder: string; force?: boolean }) {
  const goldenUrlObject = new URL(baseUrl);
  goldenUrlObject.pathname = `/${GOLDEN_DATABASE_NAME}`;
  const goldenUrl = goldenUrlObject.toString();
  const admin = await createAdminConnection(baseUrl);
  try {
    await admin.query(`SELECT GET_LOCK('${GOLDEN_LOCK_NAME}', 600)`);
    try {
      if (force) {
        await admin.query(`DROP DATABASE IF EXISTS \`${GOLDEN_DATABASE_NAME}\``);
        await admin.query(`CREATE DATABASE \`${GOLDEN_DATABASE_NAME}\``);
      } else {
        const [dbs] = await admin.query(`SHOW DATABASES LIKE '${GOLDEN_DATABASE_NAME}'`);
        const exists = (dbs as Array<any>).length > 0;
        if (exists) {
          const [tables] = await admin.query(
            `SELECT COUNT(*) AS c FROM information_schema.tables WHERE table_schema = '${GOLDEN_DATABASE_NAME}' AND table_name = '__drizzle_migrations'`,
          );
          if (Number((tables as Array<any>)[0].c) > 0) return;
        }
        await admin.query(`CREATE DATABASE IF NOT EXISTS \`${GOLDEN_DATABASE_NAME}\``);
      }
      const connection = await mysql.createConnection({ uri: goldenUrl, timezone: '+00:00' });
      await connection.query("SET time_zone = '+00:00'");
      const db = drizzle(connection, { schema, mode: 'default' });
      await migrate(db, { migrationsFolder });
      await connection.end();
    } finally {
      await admin.query(`SELECT RELEASE_LOCK('${GOLDEN_LOCK_NAME}')`);
    }
  } finally {
    await admin.end();
  }
}

/** 删除单个测试库。 */
export async function dropDatabase(baseUrl: string, databaseId: string) {
  const admin = await createAdminConnection(baseUrl);
  try {
    await admin.query(`DROP DATABASE IF EXISTS \`${databaseId}\``);
  } finally {
    await admin.end();
  }
}

/** 删除黄金库。 */
export async function dropGoldenDatabase(baseUrl: string) {
  const admin = await createAdminConnection(baseUrl);
  try {
    await admin.query(`DROP DATABASE IF EXISTS \`${GOLDEN_DATABASE_NAME}\``);
  } finally {
    await admin.end();
  }
}

/** 从黄金库克隆 DDL 到新的随机测试库（不复制数据）。 */
export async function cloneGoldenDatabase(baseUrl: string, databaseId: string) {
  const admin = await createAdminConnection(baseUrl);
  try {
    await admin.query(`CREATE DATABASE IF NOT EXISTS \`${databaseId}\``);
    const [rows] = await admin.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = '${GOLDEN_DATABASE_NAME}'`);
    for (const row of rows as Array<Record<string, string>>) {
      const table = Object.values(row)[0];
      await admin.query(`CREATE TABLE \`${databaseId}\`.\`${table}\` LIKE \`${GOLDEN_DATABASE_NAME}\`.\`${table}\``);
    }
    await admin.query(
      `INSERT INTO \`${databaseId}\`.\`__drizzle_migrations\` SELECT * FROM \`${GOLDEN_DATABASE_NAME}\`.\`__drizzle_migrations\``,
    );
  } finally {
    await admin.end();
  }
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
 * 生成一个全新随机库并切换到这里。该钩子负责从黄金库克隆 DDL + seed，
 * 并把当前库状态写入 testDbState 供测试文件直连。
 * 这是样板实现，你可以按需修改（换方言、跳过 seed、控制迁移目录等）。
 */
export function drizzleCleanHook(options: {
  baseUrl: () => string | Promise<string>;
  migrationsFolder: string;
}): CleanDatabaseHook {
  return async ({ databaseId }) => {
    const baseUrl = (await options.baseUrl()).replace(/\/$/, '');
    await ensureGoldenDatabase({ baseUrl, migrationsFolder: options.migrationsFolder });
    await cloneGoldenDatabase(baseUrl, databaseId);

    const url = withTestDatabase(baseUrl, databaseId);
    const connection = await mysql.createConnection({ uri: url, timezone: '+00:00' });
    await connection.query("SET time_zone = '+00:00'");
    const db = drizzle(connection, { schema, mode: 'default' });

    await db.transaction(async (tx) => executeSeed({ db: tx }));

    // 切换到新库：关闭上一个测试库的连接并删除该库。
    // 分区表克隆每库可达 100MB+，只增不减会撑爆磁盘；切库即删让同时存在的
    // 测试库数量 = 并行测试文件数（个位数），磁盘占用保持个位数 GB 以内。
    const previousDatabaseId = lastDatabaseId;
    const previousConnection = lastConnection;
    lastDatabaseId = databaseId;
    lastConnection = connection;
    testDbState.databaseId = databaseId;
    testDbState.db = db;
    testDbState.connection = connection;
    if (previousConnection) await previousConnection.end().catch(() => {});
    if (previousDatabaseId && previousDatabaseId !== databaseId) {
      // drop 不阻塞 cleanDatabase：并发的 DROP DATABASE 与 CREATE TABLE LIKE 会抢
      // MySQL 元数据锁（MDL），并行多个测试文件时 DDL 被串行化，单次 cleanDatabase 可被
      // 拖到超时。drop 改为后台执行，由 globalSetup teardown 兜底清理残留库。
      void dropDatabase(baseUrl, previousDatabaseId).catch(() => {});
    }
  };
}
