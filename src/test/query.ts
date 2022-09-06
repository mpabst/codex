import {
  A,
  builders,
  Prefixers,
  triple as t,
  quad as q,
  unwrap as u,
} from '../builders.js'
import { Clause } from '../clause.js'
import { Store } from '../store.js'
import { Bindings, Query } from '../query.js'
import { Expression } from '../syntax.js'
import { NamedNode, Quad, Variable } from '../term.js'

const { expect: x } = chai
const { fps } = Prefixers
const { v } = builders

const collectResult = (query: Query, ary: Bindings[]) => (b: Bindings) => {
  const r: Bindings = new Map()
  for (const [source, internal] of query.varNames)
    r.set(source, b.get(internal)!)
  ary.push(r)
}

describe('Query', () => {
  it('unify one quad', () => {
    const store = new Store([q(fps.test, fps.socrates, A, fps.man)])

    const source: Expression<Quad> = {
      type: 'Conjunction',
      first: {
        type: 'Pattern',
        terms: q(fps.test, v.who, A, fps.man),
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
    const data: Quad[] = []
    for (let i = 0; i < 100_000; i++)
      data.push(q(fps.test, fps[i], fps.foo, fps[i + 1]))
    const engine = new Store(data)

    const query: Expression<Quad> = {
      type: 'Conjunction',
      first: {
        type: 'Pattern',
        terms: q(fps.test, v.left, fps.foo, v.middle),
      },
      rest: {
        type: 'Pattern',
        terms: q(fps.test, v.middle, fps.foo, v.right),
      },
    }

    it('is fast', () => {
      let results = 0
      new Query(engine, query).evaluate(() => results++)
      x(results).eql(99_999)
    })
  })

  describe('basic rule invocation', () => {
    it('socrates is mortal', () => {
      const store = new Store([q(fps.test, fps.socrates, A, fps.Man)])

      new Clause(
        u(fps.rule) as NamedNode,
        store,
        { type: 'Pattern', terms: t(v.who, A, fps.Mortal) },
        {
          type: 'Pattern',
          terms: q(fps.test, v.who, A, fps.Man),
        },
      )

      const query = new Query(store, {
        type: 'Pattern',
        terms: q(fps.rule, v.someone, A, fps.Mortal),
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
