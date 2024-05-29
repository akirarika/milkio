/**
 * ⚠️ This file is generated and modifications will be overwritten
 */

// api
import type * as cookbook from '../src/apps/cookbook'
import type * as test from '../src/apps/test'
import type * as foo from '../src/apps/foo'

import _apiValidator from './products/api-validator.ts'

export default {
  apiValidator: _apiValidator,
  apiMethodsSchema: {
    'cookbook': () => ({ module: import('../src/apps/cookbook') }),
    'test': () => ({ module: import('../src/apps/test') }),
    'foo': () => ({ module: import('../src/apps/foo') }),
    
  },
  apiMethodsTypeSchema: {
    'cookbook': undefined as unknown as typeof cookbook,
    'test': undefined as unknown as typeof test,
    'foo': undefined as unknown as typeof foo,
    
  },
  apiTestsSchema: {
    'test': () => ({ module: import('../src/apps/test') }),
    'foo': () => ({ module: import('../src/apps/foo') }),
    
  },
}