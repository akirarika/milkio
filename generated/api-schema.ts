/**
 * ⚠️ This file is generated and modifications will be overwritten
 */

// api
import type * as apiTests$default from '../src/apps/api-tests/default'
import type * as apiTests$steps from '../src/apps/api-tests/steps'
import type * as apiTests$stream from '../src/apps/api-tests/stream'

import _apiValidator from './products/api-validator.ts'

export default {
  apiValidator: _apiValidator,
  apiMethodsSchema: {
    'api-tests/default': () => ({ module: import('../src/apps/api-tests/default') }),
    'api-tests/steps': () => ({ module: import('../src/apps/api-tests/steps') }),
    'api-tests/stream': () => ({ module: import('../src/apps/api-tests/stream') }),
    
  },
  apiMethodsTypeSchema: {
    'api-tests/default': undefined as unknown as typeof apiTests$default,
    'api-tests/steps': undefined as unknown as typeof apiTests$steps,
    'api-tests/stream': undefined as unknown as typeof apiTests$stream,
    
  },
  apiTestsSchema: {
    'api-tests/default': () => ({ module: import('../src/apps/api-tests/default') }),
    'api-tests/steps': () => ({ module: import('../src/apps/api-tests/steps') }),
    'api-tests/stream': () => ({ module: import('../src/apps/api-tests/stream') }),
    
  },
}