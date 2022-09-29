import { Prefixers, variable } from '../data-factory.js'
import { Bindings, Processor } from '../processor.js'
import { Query } from '../query.js'
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
    const query = new Query(module, body)
    debugger
    new Processor().evaluate(query, (b: Bindings) => console.log(b.get(variable('who'))))
  })
})
