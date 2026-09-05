import { expect, test } from 'vitest';
import { astra } from '../utils/astra.ts';

test('basic', async () => {
    const [context, reject, world] = await astra.createMirrorWorld(import.meta.url);

    // 每次显式调用都会新建一个随机测试库、完整迁移并 seed，然后切换过去。
    // 如果你的项目不使用数据库，可以删除这一行。
    await world.cleanDatabase();

    const [error, result] = await world.execute('/', {
        generateParams: true,
    });
    if (error) throw reject('Milkio did not execute successfully', error);

    expect(result.message).toBe('Hello world! UwU');
});
