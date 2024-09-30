/**
 * ⚠️ This file is generated and modifications will be overwritten
 */
import type * as apiTests$stream from '../src/apps/api-tests/stream';
import type * as apiTests$default from '../src/apps/api-tests/default';
import type * as apiTests$steps from '../src/apps/api-tests/steps';
declare const _default: {
    apiValidator: {
        generatedAt: number;
        validate: {
            'api-tests/stream': () => Promise<typeof import("./products/apps/api-tests/stream.ts")>;
            'api-tests/default': () => Promise<typeof import("./products/apps/api-tests/default.ts")>;
            'api-tests/steps': () => Promise<typeof import("./products/apps/api-tests/steps.ts")>;
        };
    };
    apiMethodsSchema: {
        'api-tests/stream': () => {
            module: Promise<typeof apiTests$stream>;
        };
        'api-tests/default': () => {
            module: Promise<typeof apiTests$default>;
        };
        'api-tests/steps': () => {
            module: Promise<typeof apiTests$steps>;
        };
    };
    apiMethodsTypeSchema: {
        'api-tests/stream': typeof apiTests$stream;
        'api-tests/default': typeof apiTests$default;
        'api-tests/steps': typeof apiTests$steps;
    };
    apiTestsSchema: {
        'api-tests/stream': () => {
            module: Promise<typeof apiTests$stream>;
        };
        'api-tests/default': () => {
            module: Promise<typeof apiTests$default>;
        };
        'api-tests/steps': () => {
            module: Promise<typeof apiTests$steps>;
        };
    };
};
export default _default;
