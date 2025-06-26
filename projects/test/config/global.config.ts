import { config } from 'milkio'

export default config(mode => ({
  baz: 'baz',
  foo: mode,
  bar: 10000,
}))
