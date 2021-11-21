import { namedNode as nn, variable as vari } from '../../data-factory.js'
import { FlatQuad } from '../../term.js'
import { add, store } from '../../collections/store.js'
import { evaluate } from '../query.js'
import { Conjunction } from '../syntax.js'

const { expect: x } = chai

const DATA: FlatQuad[] = [
  [nn(':a'), nn(':foo'), nn(':b'), nn(':test')],
  [nn(':b'), nn(':foo'), nn(':c'), nn(':test')],
]

// for (let i = 0; i < 100_000; i++)
//   DATA.push([nn(`:${i}`), nn(':foo'), nn(`:${i + 1}`), nn(':test')])

console.log(DATA.length)

const QUERY: Conjunction = {
  type: 'Conjunction',
  head: {
    type: 'Line',
    pattern: [vari('x'), nn(':foo'), vari('y'), nn(':test')],
    order: 'SPOG'
  },
  tail: {
    type: 'Line',
    pattern: [vari('y'), nn(':foo'), vari('z'), nn(':test')],
    order: 'SPOG'
  }
}

// and: [
//   ,
//   // [vari('y'), nn(':foo'), vari('z'), nn(':test')]
// ],
// or: [
//   // {
//   //   and: [[vari('y'), nn(':foo'), nn(':fail'), nn(':test')]],
//   //   or: []
//   // },
//   // {
//   //   and: [[vari('y'), nn(':foo'), vari('z'), nn(':test')]],
//   //   or: []
//   // }
// ]

function buildStore(data: FlatQuad[]) {
  const out = store()
  for (const d of data) add(out, d)
  return out
}

describe('query()', () => {
  it('evaluate', () => {
    let count = 0
    evaluate(buildStore(DATA), QUERY, console.log)
    console.log(count)
  })
})
