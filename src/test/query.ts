import { Prefixers } from '../data-factory.js'
import { Store } from '../store.js'

const { test } = Prefixers

describe('Query', () => {
  it('smoke test', async () => {
    const store = new Store()
    const name = test('mortality.fp')
    await store.load(name)
    debugger
    console.log(`loaded: ${name}`)
  })
})
