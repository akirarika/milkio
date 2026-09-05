import { defineProject } from 'vitest/config';

export default defineProject({
    test: {
        testTimeout: 60000,
        // 每次运行只执行一次：删除上一次遗留的随机测试库、清空缓存
        globalSetup: ['./app/utils/astra-global-setup.ts'],
        // 测试使用独立的随机测试库（每次 cleanDatabase 都会新建并切换），
        // 不同测试文件之间互不干扰，因此可以放开并行限制
        sequence: {
            concurrent: false,
        },
    },
});
