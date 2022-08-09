import { A, builders, Prefixers, PREFIXES, unwrap } from '../builders.js'
import { Index } from '../collections/index.js'
import { Bindings, Query } from '../query.js'
import { Key, Store } from '../store.js'
import { Expression } from '../syntax.js'
import { FlatQuad, FlatTriple, Term } from '../term.js'

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

const prefixes = new Map()
for (const [abbrev, url] of Object.entries(PREFIXES)) prefixes.set(url, abbrev)

function prefixify({ value }: Term): string {
  for (const [url, abbrev] of prefixes)
    if (value.startsWith(url)) return value.replace(url, abbrev + ':')
  return value
}

function printBindings(bindings: Bindings): void {
  const out = []
  for (const pair of bindings) out.push(pair.map(prefixify).join(': '))
  console.log(out.join('\n'))
}

function printQuad(q: FlatQuad): void {
  const out = []
  for (const t of q) out.push(prefixify(t))
  console.log(out.join(' '))
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
    for (let i = 0; i < 100_000; i++) {
      const quad = unwrap(fps.test, fps[i], fps.foo, fps[i + 1])
      // printQuad(quad)
      data.push(quad)
    }

    const query: Expression = {
      type: 'Conjunction',
      first: {
        type: 'Pattern',
        terms: unwrap(fps.test, v.left, fps.foo, v.middle),
        order: 'GSPO',
      },
      // rest: null,
      rest: {
        type: 'Pattern',
        terms: unwrap(fps.test, v.middle, fps.foo, v.right),
        order: 'GSPO',
      },
    }

    let results = 0
    new Query(buildStore(data), query).evaluate(() => results++)
    console.log(results)
    // x(results).eql(1)
  })
})
