export type CookbookActionParams = {
    type: 'milkio@ping'
  } | {
    type: 'milkio@logger'
    log: Array<any>
  } | {
    type: 'milkio@template'
    name: string
    fsPath: string
    template: string
  } | {
    type: 'project@list'
  } | {
    type: 'project@log'
    key: string
    firstId: number
  }
  
  export interface CookbookOptions {
    projects: Record<string, {
      type: 'milkio' | 'custom'
      port: number
      start: Array<string>
      build: Array<string>
      name?: string
      watch?: boolean
      lazyRoutes?: boolean
      typiaMode?: 'generation' | 'bundler'
      significant?: Array<string>
      insignificant?: Array<string>
      autoStart?: boolean
      autoStartDelay?: number
      connectTestUrl?: string
    }>
    general: {
      start: string
      cookbookPort: number
    }
  }
  export type CookbookSubscribeEmits = {
    type: 'workers@stdout'
    key: string
    chunk: string
  } | {
    type: 'workers@state'
    key: string
    state: 'running' | 'stopped'
    code: number | null | 'kill' | 'running'
  } | {
    type: 'watcher@change'
    event: 'rename' | 'change'
    path: string
  } | {
    type: 'milkio@logger'
    log: Array<any>
  }
  