import { Prefixers } from '../data-factory.js'
import { Bindings, Processor } from '../processor.js'
import { TopLevel } from '../query.js'
import { Store } from '../store.js'
import { printBindings } from './helpers.js'

const { fpc, test } = Prefixers

describe('Query', () => {
  it.only('smoke test', async () => {
    const store = new Store()
    const name = test('query')
    await store.load(name)
    console.log(`loaded: ${name}`)
    const module = store.modules.get(test('query'))!
    const [body] = module.facts
      .getRoot('SPO')
      .get(test('query#whoIsMortal'))!
      .get(fpc('body'))
    const query = new TopLevel(module, body)
    // debugger
    // const proc = new Processor()    
    for (let i = 0; i < 100; i++) {
      if (i % 10 === 0) console.log(new Date().toISOString());
      new Processor().evaluate(query, () => {})
    }
    // console.log(proc.instrCount)
  })
})
