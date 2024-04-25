/**
 * ⚠️ This file is generated and modifications will be overwritten
 */
import type * as cookbook from '../src/apps/cookbook';
import type * as aSandbox$sandbox from '../src/apps/a-sandbox/sandbox';
import type * as $$default from '../src/apps/$/default';
import type * as $$say from '../src/apps/$/say';
import type * as helloWorld$say from '../src/apps/hello-world/say';
declare const _default: {
    apiValidator: {
        generatedAt: number;
        validate: {
            cookbook: () => Promise<typeof import("./products/apps/cookbook.ts")>;
            'a-sandbox/sandbox': () => Promise<typeof import("./products/apps/a-sandbox/sandbox.ts")>;
            '$/default': () => Promise<typeof import("./products/apps/$/default.ts")>;
            '$/say': () => Promise<typeof import("./products/apps/$/say.ts")>;
            'hello-world/say': () => Promise<typeof import("./products/apps/hello-world/say.ts")>;
        };
    };
    apiMethodsSchema: {
        cookbook: () => {
            module: Promise<typeof cookbook>;
        };
        'a-sandbox/sandbox': () => {
            module: Promise<typeof aSandbox$sandbox>;
        };
        '$/default': () => {
            module: Promise<typeof $$default>;
        };
        '$/say': () => {
            module: Promise<typeof $$say>;
        };
        'hello-world/say': () => {
            module: Promise<typeof helloWorld$say>;
        };
    };
    apiMethodsTypeSchema: {
        cookbook: typeof cookbook;
        'a-sandbox/sandbox': typeof aSandbox$sandbox;
        '$/default': typeof $$default;
        '$/say': typeof $$say;
        'hello-world/say': typeof helloWorld$say;
    };
    apiTestsSchema: {
        'a-sandbox/sandbox': () => {
            module: Promise<typeof aSandbox$sandbox>;
        };
        'hello-world/say': () => {
            module: Promise<typeof helloWorld$say>;
        };
    };
};
export default _default;
