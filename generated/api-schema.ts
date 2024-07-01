/**
 * ⚠️ This file is generated and modifications will be overwritten
 */

// api
import type * as foo from '../src/apps/foo'
import type * as cookbook from '../src/apps/cookbook'
import type * as test from '../src/apps/test'

import _apiValidator from './products/api-validator.ts'

export default {
  apiValidator: _apiValidator,
  apiMethodsSchema: {
    'foo': () => ({ module: import('../src/apps/foo') }),
    'cookbook': () => ({ module: import('../src/apps/cookbook') }),
    'test': () => ({ module: import('../src/apps/test') }),
    
  },
  apiMethodsTypeSchema: {
    'foo': undefined as unknown as typeof foo,
    'cookbook': undefined as unknown as typeof cookbook,
    'test': undefined as unknown as typeof test,
    
  },
  apiTestsSchema: {
    'foo': () => ({ module: import('../src/apps/foo') }),
    'test': () => ({ module: import('../src/apps/test') }),
    
  },
}