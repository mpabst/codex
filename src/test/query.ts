import { Prefixers } from '../data-factory.js'
import { Bindings, Processor } from '../processor.js'
import { TopLevel } from '../query.js'
import { Store } from '../store.js'
import { printBindings } from './helpers.js'

const { fpc, test } = Prefixers

describe('Query', () => {
  it.only('who is mortal?', async () => {
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
    // const proc = new Processor()    
    for (let i = 0; i < 100; i++) {
      if (i % 10 === 0) console.log(new Date().toISOString());
      new Processor().evaluate(query, () => {})
    }
    // console.log(proc.instrCount)
  })
})
