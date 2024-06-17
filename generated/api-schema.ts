/**
 * ⚠️ This file is generated and modifications will be overwritten
 */

// api
import type * as test from '../src/apps/test'
import type * as foo from '../src/apps/foo'
import type * as cookbook from '../src/apps/cookbook'

import _apiValidator from './products/api-validator.ts'

export default {
  apiValidator: _apiValidator,
  apiMethodsSchema: {
    'test': () => ({ module: import('../src/apps/test') }),
    'foo': () => ({ module: import('../src/apps/foo') }),
    'cookbook': () => ({ module: import('../src/apps/cookbook') }),
    
  },
  apiMethodsTypeSchema: {
    'test': undefined as unknown as typeof test,
    'foo': undefined as unknown as typeof foo,
    'cookbook': undefined as unknown as typeof cookbook,
    
  },
  apiTestsSchema: {
    'test': () => ({ module: import('../src/apps/test') }),
    'foo': () => ({ module: import('../src/apps/foo') }),
    
  },
}