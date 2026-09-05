import type { MySql2Database } from 'drizzle-orm/mysql2';
import type * as schema from '../../.milkio/drizzle-schema.ts';

// 项目自定义的 context 挂载点。这里只挂 db，不挂全局 tx：
// 事务应通过 `context.db.transaction(async (tx) => { ... })` 由调用方显式传递 tx 对象。
// 如需切换到 pg / sqlite，请把类型换成对应的 drizzle 数据库类型并安装相应驱动。
export interface _ {
  db: MySql2Database<typeof schema>;
}
