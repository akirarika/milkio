// 当前测试文件进程内「正在使用的随机测试库」状态。
// world.cleanDatabase() 每次都会新建一个随机库并切换，drizzle/redis 的
// cleanDatabase 钩子会把最新状态写到这里；测试文件里的直连 db/redis
// 辅助（db、testRedisKey、getCurrentTestDbUrl）都从这里读取当前库。
export const testDbState: {
  databaseId: string | null;
  db: any | null;
  connection: { end: () => Promise<void> } | null;
} = {
  databaseId: null,
  db: null,
  connection: null,
};
