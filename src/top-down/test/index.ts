import {A, Prefixers, builders, unwrap} from '../../builders.js'
import {namedNode as nn} from '../../data-factory.js'
import {FlatQuad} from '../../term.js'
import {Index} from '../../collections/index.js'
import {evaluate} from '../query.js'
import {Expression} from '../syntax.js'

const {expect: x} = chai
const {fps} = Prefixers
const {v} = builders

const DATA: FlatQuad[] = [
  unwrap(fps.socrates, A, fps.man, fps.test),
  // [nn(':a'), nn(':foo'), nn(':b'), nn(':test')],
  // [nn(':b'), nn(':foo'), nn(':c'), nn(':test')],
]

// for (let i = 0; i < 100_000; i++)
//   DATA.push([nn(`:${i}`), nn(':foo'), nn(`:${i + 1}`), nn(':test')])

console.log(DATA.length)

const QUERY: Expression = {
  type: 'Conjunction',
  first: {
    type: 'Pattern',
    terms: unwrap(v.who, A, fps.mortal, fps.test),
    order: 'SPOG',
    // varMaps: new Map([unwrap(v.who, v.person)])
  },
  rest: null,

  // {
  //   type: 'Pattern',
  //   pattern: [vari('y'), nn(':foo'), vari('z'), nn(':test')],
  //   order: 'SPOG'
  // }
}

// and: [
// ,
// [vari('y'), nn(':foo'), vari('z'), nn(':test')]
// ],
// or: [
// {
//   and: [[vari('y'), nn(':foo'), nn(':fail'), nn(':test')]],
//   or: []
// },
// {
//   and: [[vari('y'), nn(':foo'), vari('z'), nn(':test')]],
//   or: []
// }
// ]

function buildStore(data: FlatQuad[]) {
  const out = new Index()
  for (const d of data) out.add(d)
  return out
}

describe('query()', () => {
  it('evaluate', () => {
    let count = 0
    evaluate(buildStore(DATA), QUERY, console.log)
    console.log(count)
  })
})
