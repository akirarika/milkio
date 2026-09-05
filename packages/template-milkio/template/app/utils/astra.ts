import { createAstra } from '@milkio/astra';
import { createStargate } from '@milkio/stargate';
import { fileURLToPath } from 'node:url';
import type { generated } from '../../.milkio/index.ts';
import { drizzleCleanHook } from './drizzle-test.ts';
import { redisCleanHook } from './redis-test.ts';

export const stargate = await createStargate<typeof generated>({
  baseUrl: 'http://localhost:9000',
});

export const astra = await createAstra({
  stargate,
  bootstrap: async (hooks) => {
    // 订阅 cleanDatabase 钩子：world.cleanDatabase() 每次都会新建一个随机库并切换，
    // 然后并行执行这里注册的所有 hook（建库+迁移+seed、清当前库 redis 命名空间等）。
    // 上一次运行遗留的随机测试库在 vitest globalSetup 里统一删除
    // （见 astra-global-setup.ts），不能在这里删——并行运行的其他测试文件正在使用它们。
    // 如果你的项目不使用数据库，可以删除这些 hook。
    hooks.onCleanDatabase(drizzleCleanHook({
      baseUrl: () => 'mysql://root:a58423c29020@127.0.0.1:3306/',
      migrationsFolder: fileURLToPath(new URL('../../drizzle', import.meta.url)),
    }));
    hooks.onCleanDatabase(redisCleanHook({ url: () => 'redis://127.0.0.1:6379/1' }));

    return {};
  },
});
