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
} | {
  type: 'project@stop'
  key: string
} | {
  type: 'project@start'
  key: string
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
    prismaMigrateMode?: 'migrate-dev' | 'push'
  }>
  general: {
    start: string
    packageManager: string
    cookbookPort: number
  },
  config: {
    [key: string]: string | number | boolean
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
