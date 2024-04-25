/**
 * ⚠️ This file is generated and modifications will be overwritten
 */

// api
import type * as cookbook from '../src/apps/cookbook'
import type * as aSandbox$sandbox from '../src/apps/a-sandbox/sandbox'
import type * as $$default from '../src/apps/$/default'
import type * as $$say from '../src/apps/$/say'
import type * as helloWorld$say from '../src/apps/hello-world/say'

import _apiValidator from './products/api-validator.ts'

export default {
  apiValidator: _apiValidator,
  apiMethodsSchema: {
    'cookbook': () => ({ module: import('../src/apps/cookbook') }),
    'a-sandbox/sandbox': () => ({ module: import('../src/apps/a-sandbox/sandbox') }),
    '$/default': () => ({ module: import('../src/apps/$/default') }),
    '$/say': () => ({ module: import('../src/apps/$/say') }),
    'hello-world/say': () => ({ module: import('../src/apps/hello-world/say') }),
    
  },
  apiMethodsTypeSchema: {
    'cookbook': undefined as unknown as typeof cookbook,
    'a-sandbox/sandbox': undefined as unknown as typeof aSandbox$sandbox,
    '$/default': undefined as unknown as typeof $$default,
    '$/say': undefined as unknown as typeof $$say,
    'hello-world/say': undefined as unknown as typeof helloWorld$say,
    
  },
  apiTestsSchema: {
    'a-sandbox/sandbox': () => ({ module: import('../src/apps/a-sandbox/sandbox') }),
    'hello-world/say': () => ({ module: import('../src/apps/hello-world/say') }),
    
  },
}