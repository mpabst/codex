import { A, builders, Prefixers, unwrap } from '../builders.js'
import { Bindings, Query } from '../query.js'
import { Expression } from '../syntax.js'
import { FlatQuad } from '../term.js'
import { buildStore } from './helpers.js'

const { expect: x } = chai
const { fps } = Prefixers
const { v } = builders

describe('query()', () => {
  it('who is a man?', () => {
    const store = buildStore([unwrap(fps.test, fps.socrates, A, fps.man)])

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
    new Query(store, query).evaluate((b) => results.push(b))

    x(results.length).eql(1)

    const [r] = results
    x(r.size).eql(1)
    x(r.get(unwrap(v.who)[0])).eql(unwrap(fps.socrates)[0])
  })

  describe('perf', () => {
    const data: FlatQuad[] = []
    for (let i = 0; i < 100_000; i++)
      data.push(unwrap(fps.test, fps[i], fps.foo, fps[i + 1]))
    const store = buildStore(data)

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

    it('is fast', () => {
      let results = 0
      new Query(store, query).evaluate(() => results++)
      x(results).eql(99_999)
    })
  })
})
