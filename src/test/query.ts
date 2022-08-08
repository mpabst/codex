import { A, builders, Prefixers, unwrap } from '../builders.js'
import { Index } from '../collections/index.js'
import { Query } from '../query.js'
import { Key, Store } from '../store.js'
import { Expression } from '../syntax.js'
import { FlatQuad, FlatTriple } from '../term.js'

const { expect: x } = chai
const { fps } = Prefixers
const { v } = builders

const DATA: FlatQuad[] = [unwrap(fps.test, fps.socrates, A, fps.man)]

console.log(DATA.length)

const QUERY: Expression = {
  type: 'Conjunction',
  first: {
    type: 'Pattern',
    terms: unwrap(fps.test, v.who, A, fps.man),
    order: 'GSPO',
  },
  rest: null,
}

function buildStore(data: FlatQuad[]) {
  const out = new Store()
  for (const d of data) {
    let context = out.get(d[0] as Key)
    if (!context) {
      context = new Index()
      out.set(d[0] as Key, context)
    }
    ;(context as Index).add(d.slice(1) as FlatTriple)
  }
  return out
}

describe('query()', () => {
  it('evaluate', () => {
    let count = 0
    new Query(buildStore(DATA), QUERY).evaluate()
    // console.log(count)
  })
})
