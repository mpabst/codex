import { Prefixers } from '../data-factory.js'
import { Bindings, Processor } from '../processor.js'
import { TopLevel } from '../query.js'
import { Store } from '../store.js'

const { fpc, test } = Prefixers

describe('Query', () => {
  it.only('smoke test', async () => {
    const store = new Store()
    const name = test('query.fp')
    await store.load(name)
    console.log(`loaded: ${name}`)
    const module = store.modules.get(test('query.fp'))!
    const [body] = module.facts
      .getRoot('SPO')
      .get(test('query.fp#whoIsMortal'))!
      .get(fpc('body'))
    const query = new TopLevel(module, body)
    debugger
    const proc = new Processor()    
    for (let i = 0; i < 1; i++) proc.evaluate(query, (b: Bindings) => {})
    console.log(proc.instrCount)
  })
})
