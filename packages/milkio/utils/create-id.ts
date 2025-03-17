import { defineIdGenerator } from 'milkid'

const idGenerator = defineIdGenerator({
  length: 32,
  hyphen: false,
  fingerprint: false,
  timestamp: true,
  sequential: false,
})

export const __createId = idGenerator.createId
