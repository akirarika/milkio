import { defineProject } from 'vitest/config';

export default defineProject({
    test: {
        testTimeout: 60000,
        fileParallelism: false,
        sequence: {
            concurrent: false,
        },
    },
});
