import { A, builders, Prefixers, unwrap } from '../builders.js'
import { Index } from '../collections/index.js'
import { Bindings, Query } from '../query.js'
import { Key, Store } from '../store.js'
import { Expression } from '../syntax.js'
import { FlatQuad, FlatTriple } from '../term.js'

const { expect: x } = chai
const { fps } = Prefixers
const { v } = builders

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
  it('who is a man?', () => {
    const data: FlatQuad[] = [unwrap(fps.test, fps.socrates, A, fps.man)]

    const query: Expression = {
      type: 'Conjunction',
      first: {
        type: 'Pattern',
        terms: unwrap(fps.test, v.who, A, fps.man),
        order: 'GSPO',
      },
      rest: null,
    }

    let results: Bindings[] = []
    new Query(buildStore(data), query).evaluate((b) => results.push(b))

    x(results.length).eql(1)

    const [r] = results
    x(Array.from(r.keys()).length).eql(1)
    x(r.get(unwrap(v.who)[0])).eql(unwrap(fps.socrates)[0])
  })

  it.only('perf', () => {
    const data: FlatQuad[] = []
    for (let i = 0; i < 4; i += 2)
      data.push(
        unwrap(fps.test, fps[i], fps.foo, fps[i + 1]),
        unwrap(fps.test, fps[i + 1], fps.foo, fps[i + 2]),
      )

    const query: Expression = {
      type: 'Conjunction',
      first: {
        type: 'Pattern',
        terms: unwrap(fps.test, v.left, fps.foo, v.middle),
        order: 'GSPO',
      },
      rest: {
        type: 'Pattern',
        terms: unwrap(fps.test, v.middle, fps.foo, v.right),
        order: 'GSPO',
      },
    }

    let results = 0
    new Query(buildStore(data), query).evaluate()

    // x(results).eql(1)
  })
})
