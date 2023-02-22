import { Prefixers } from '../data-factory.js'
import { Bindings, Processor } from '../processor.js'
import { TopLevel } from '../query.js'
import { Store } from '../store.js'
import { printBindings } from '../debug.js'

const { fpc, test } = Prefixers

describe('Query', () => {
  it.only('append', async () => {
    const store = new Store()

    const node = test('append')
    await store.load(node)
    console.log(`loaded: ${node}`)

    const mod = store.modules.get(node)!
    const [body] = mod.facts
      .getRoot('SPO')
      .get(test('append#query'))!
      .get(fpc('body'))

    const query = new TopLevel(mod, body)
    for (let i = 0; i < 1; i++) {
      if (i % 10 === 0) console.log(new Date().toISOString())
      new Processor().evaluate(query, () => { debugger })
    }
  })

  it('who is mortal?', async () => {
    const store = new Store()

    const node = test('who-is-mortal')
    await store.load(node)
    console.log(`loaded: ${node}`)

    const mod = store.modules.get(node)!
    const [body] = mod.facts
      .getRoot('SPO')
      .get(test('who-is-mortal#'))!
      .get(fpc('body'))

    const query = new TopLevel(mod, body)
    for (let i = 0; i < 100; i++) {
      if (i % 10 === 0) console.log(new Date().toISOString())
      new Processor().evaluate(query, () => {})
    }
  })
})
