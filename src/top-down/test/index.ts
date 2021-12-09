import { namedNode as nn, variable as vari, Prefixers } from '../../data-factory.js'
import { FlatQuad } from '../../term.js'
import { add, store } from '../../collections/store.js'
import { evaluate } from '../query.js'
import { Expression } from '../syntax.js'

const { expect: x } = chai
const { rdf, fps } = Prefixers

const DATA: FlatQuad[] = [
  [fps('socrates'), rdf('type'), fps('man'), fps('test')]
  // [nn(':a'), nn(':foo'), nn(':b'), nn(':test')],
  // [nn(':b'), nn(':foo'), nn(':c'), nn(':test')],
]

// for (let i = 0; i < 100_000; i++)
//   DATA.push([nn(`:${i}`), nn(':foo'), nn(`:${i + 1}`), nn(':test')])

console.log(DATA.length)

const QUERY: Expression = {
  type: 'Conjunction',
  first: {
    type: 'Call',
    terms: [vari('who'), rdf('type'), fps('mortal'), fps('test')],
    varMap: new Map([[vari('who'), vari('person')]]),
  },
  rest: null
  
  // {
  //   type: 'Pattern',
  //   pattern: [vari('y'), nn(':foo'), vari('z'), nn(':test')],
  //   order: 'SPOG'
  // }
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
