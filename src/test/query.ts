import { Clause } from '../clause.js'
import { Prefixers, variable as v } from '../data-factory.js'
import { Bindings, Machine } from '../machine.js'
import { Store } from '../store.js'
import { Expression } from '../syntax.js'
import { Graph, Object, Predicate, Quad, Subject, Triple } from '../term.js'

const { expect: x } = chai
const { test, rdf } = Prefixers

const A = rdf('type')

const collectResult = (query: Machine, ary: Bindings[]) => (b: Bindings) => {
  const r: Bindings = new Map()
  for (const [source, internal] of query.varNames)
    r.set(source, b.get(internal)!)
  ary.push(r)
}

function t(subject: Subject, predicate: Predicate, object: Object): Triple {
  return { subject, predicate, object }
}

function q(
  graph: Graph,
  subject: Subject,
  predicate: Predicate,
  object: Object,
): Quad {
  return { graph, subject, predicate, object }
}

describe('Query', () => {
  it('unify one quad', () => {
    const store = new Store([q(test(''), test('socrates'), A, test('man'))])

    const source: Expression<Quad> = {
      type: 'Conjunction',
      first: {
        type: 'Pattern',
        terms: q(test(''), v('who'), A, test('man')),
      },
      rest: null,
    }

    const query = new Machine(store, source)

    let results: Bindings[] = []
    query.evaluate(collectResult(query, results))

    x(results.length).eql(1)

    const [r] = results
    x(r.size).eql(1)
    x(r.get(v('who'))).eql(test('socrates'))
  })

  describe('basic conjunction performance', () => {
    const data: Quad[] = []
    for (let i = 0; i < 100_000; i++)
      data.push(
        q(test(''), test(i.toString()), test('foo'), test((i + 1).toString())),
      )
    const engine = new Store(data)

    const query: Expression<Quad> = {
      type: 'Conjunction',
      first: {
        type: 'Pattern',
        terms: q(test(''), v('left'), test('foo'), v('middle')),
      },
      rest: {
        type: 'Pattern',
        terms: q(test(''), v('middle'), test('foo'), v('right')),
      },
    }

    it('is fast', () => {
      let results = 0
      new Machine(engine, query).evaluate(() => results++)
      x(results).eql(99_999)
    })
  })

  describe('basic rule invocation', () => {
    it('socrates is mortal', () => {
      const store = new Store([q(test(''), test('socrates'), A, test('Man'))])

      new Clause(
        test('rule'),
        store,
        { type: 'Pattern', terms: t(v('who'), A, test('Mortal')) },
        {
          type: 'Pattern',
          terms: q(test(''), v('who'), A, test('Man')),
        },
      )

      const query = new Machine(store, {
        type: 'Pattern',
        terms: q(test('rule'), v('someone'), A, test('Mortal')),
      })

      const results: Bindings[] = []
      query.evaluate(collectResult(query, results))

      x(results.length).eql(1)
      const [r] = results
      x(r.size).eql(1)
      x(r.get(v('someone'))).eql(test('socrates'))
    })
  })
})
