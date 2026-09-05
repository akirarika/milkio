import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import { getTestDatabaseId, withTestDatabase } from '@milkio/drizzle';
import * as schema from '../../../.milkio/drizzle-schema.ts';
import type { MilkioWorld } from 'milkio';
import type { generated } from '../../../.milkio/index.ts';

// 数据库连接池按「连接 URL」懒建，测试环境下每个随机库一个连接。
// 这是样板代码，你可以按项目需要自由修改（换 pg/sqlite、加 SQL 日志、调连接数等）。
const pools = new Map<string, mysql.Pool | mysql.Connection>();

export function loadDrizzle(world: MilkioWorld<typeof generated>) {
  world.on('milkio:executeBefore', async (event) => {
    const baseUrl = world.config.drizzle.url;

    // 测试模式下，astra 会携带 x-milkio-test-db 请求头指明本次请求的随机数据库；
    // 没有携带时（本地网页调试 / 生产环境）走默认库，行为与旧版完全一致。
    const databaseId = getTestDatabaseId(event.context.headers);
    const url = withTestDatabase(baseUrl, databaseId);

    let pool = pools.get(url);
    if (!pool) {
      if (world.isTestMode) {
        // 本地 test 库会话时区非 UTC：用单连接并显式固定 UTC+0，
        // 保证 seed 写入的墙钟与读取口径统一。
        const connection = await mysql.createConnection({ uri: url, timezone: '+00:00' });
        await connection.query("SET time_zone = '+00:00'");
        pool = connection;
      } else {
        pool = mysql.createPool({ uri: url, connectionLimit: 8 });
      }
      pools.set(url, pool);
    }

    // 只挂 context.db（不挂全局 tx）。事务请在业务代码里用 db.transaction 显式管理。
    event.context.db = drizzle(pool, { schema, mode: 'default' });
  });
}
