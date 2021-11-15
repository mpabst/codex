import { namedNode as nn, variable as vari } from '../../data-factory.js'
import { FlatQuad } from '../../term.js'
import { add, store } from '../../collections/store.js'
import { query, Query } from '../query.js'

const { expect: x } = chai

const DATA: FlatQuad[] = [
  // [nn(':a'), nn(':foo'), nn(':b'), nn(':test')],
  // [nn(':b'), nn(':foo'), nn(':c'), nn(':test')],
]

for (let i = 0; i < 100_000; i++)
  DATA.push([nn(`:${i}`), nn(':foo'), nn(`:${i + 1}`), nn(':test')])

console.log(DATA.length)

const QUERY: Query = {
  and: [
    [vari('x'), nn(':foo'), vari('y'), nn(':test')],
  ],
  or: [
    // [
    //   [vari('b'), nn(':foo'), vari('c'), nn(':test')]
    // ]
  ]
}

function buildStore() {
  const out = store()
  for (const d of DATA) add(out, d)
  return out
}

describe('query()', () => {
  x(true).eq(true)
  it('ancestry', () => {
    query(buildStore(), QUERY, () => {})
  })
})
