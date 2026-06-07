export interface _ {
  'event:notify': {
    message: string
    received: string[]
  }
  'event:approve': {
    message: string
    allow: boolean
    received: string[]
  }
}