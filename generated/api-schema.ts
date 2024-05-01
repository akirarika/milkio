/**
 * ⚠️ This file is generated and modifications will be overwritten
 */

// api
import type * as cookbook from '../src/apps/cookbook'

import _apiValidator from './products/api-validator.ts'

export default {
  apiValidator: _apiValidator,
  apiMethodsSchema: {
    'cookbook': () => ({ module: import('../src/apps/cookbook') }),
    
  },
  apiMethodsTypeSchema: {
    'cookbook': undefined as unknown as typeof cookbook,
    
  },
  apiTestsSchema: {
    
  },
}