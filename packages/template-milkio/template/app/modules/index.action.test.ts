import { expect, test } from 'vitest';
import { astra } from '../utils/astra.ts';

test('basic', async () => {
    const [context, reject, world] = await astra.createMirrorWorld(import.meta.url);
    const [error, result] = await world.execute('/', {
        generateParams: true,
    });
    if (error) throw reject('Milkio did not execute successfully', error);

    expect(result.message).toBe('Hello world! UwU');
});
