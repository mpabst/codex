import { A, builders, Prefixers, unwrap } from '../builders.js'
import { Clause } from '../clause.js'
import { Index } from '../collections/index.js'
import { Bindings, Query } from '../query.js'
import { Store } from '../store.js'
import { Expression } from '../syntax.js'
import { FlatQuad } from '../term.js'
import { buildStore } from './helpers.js'

const { expect: x } = chai
const { fps } = Prefixers
const { v } = builders

describe('Query', () => {
  it('unify one quad', () => {
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
    new Query(store, query).evaluate(b => results.push(b))

    x(results.length).eql(1)

    const [r] = results
    x(r.size).eql(1)
    x(r.get(unwrap(v.who)[0])).eql(unwrap(fps.socrates)[0])
  })

  describe('basic conjunction performance', () => {
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

  describe('basic rule invocation', () => {
    it('socrates is mortal', () => {
      const store = buildStore([unwrap(fps.test, fps.socrates, A, fps.Man)])
      new Clause(
        unwrap(fps.rule)[0],
        store,
        { type: 'Pattern', terms: unwrap(v.who, A, fps.Mortal), order: 'SPO' },
        {
          type: 'Pattern',
          terms: unwrap(fps.test, v.who, A, fps.Man),
          order: 'GSPO',
        },
      )
      const query = new Query(store, {
        type: 'Pattern',
        terms: unwrap(fps.rule, v.someone, A, fps.Mortal),
        order: 'GSPO',
      })
      query.evaluate(console.log)
    })
  })
})
