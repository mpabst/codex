import { A, builders, Prefixers, unwrap } from '../builders.js'
import { Clause } from '../clause.js'
import { Bindings, Query } from '../query.js'
import { Expression } from '../syntax.js'
import { FlatQuad, NamedNode, Term, Variable } from '../term.js'
import { buildStore } from './helpers.js'

const { expect: x } = chai
const { fps } = Prefixers
const { v } = builders

const collectResult = (query: Query, ary: Bindings[]) => (b: Bindings) => {
  const r: Bindings = new Map()
  for (const [source, internal] of query.varNames)
    r.set(source, b.get(internal)!)
  ary.push(r)
}

function u(builder: any): Term {
  return unwrap(builder)[0]
}

describe('Query', () => {
  it('unify one quad', () => {
    const store = buildStore([unwrap(fps.test, fps.socrates, A, fps.man)])

    const source: Expression = {
      type: 'Conjunction',
      first: {
        type: 'Pattern',
        terms: unwrap(fps.test, v.who, A, fps.man),
        order: 'GSPO',
      },
      rest: null,
    }

    const query = new Query(store, source)

    let results: Bindings[] = []
    query.evaluate(collectResult(query, results))

    x(results.length).eql(1)

    const [r] = results
    x(r.size).eql(1)
    x(r.get(u(v.who) as Variable)).eql(u(fps.socrates))
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
        u(fps.rule) as NamedNode,
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

      const results: Bindings[] = []
      query.evaluate(collectResult(query, results))

      x(results.length).eql(1)
      const [r] = results
      x(r.size).eql(1)
      x(r.get(u(v.someone) as Variable)).eql(u(fps.socrates))
    })
  })
})
