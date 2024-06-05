/**
 * ⚠️ This file is generated and modifications will be overwritten
 */

// api
import type * as cookbook from '../src/apps/cookbook'
import type * as foo from '../src/apps/foo'
import type * as test from '../src/apps/test'

import _apiValidator from './products/api-validator.ts'

export default {
  apiValidator: _apiValidator,
  apiMethodsSchema: {
    'cookbook': () => ({ module: import('../src/apps/cookbook') }),
    'foo': () => ({ module: import('../src/apps/foo') }),
    'test': () => ({ module: import('../src/apps/test') }),
    
  },
  apiMethodsTypeSchema: {
    'cookbook': undefined as unknown as typeof cookbook,
    'foo': undefined as unknown as typeof foo,
    'test': undefined as unknown as typeof test,
    
  },
  apiTestsSchema: {
    'foo': () => ({ module: import('../src/apps/foo') }),
    'test': () => ({ module: import('../src/apps/test') }),
    
  },
}