import {A, Prefixers, builders, unwrap} from '../../builders.js'
import {namedNode as nn, variable as vari} from '../../data-factory.js'
import {FlatQuad} from '../../term.js'
import {Store} from '../../collections/store.js'
import {evaluate} from '../query.js'
import {Expression} from '../syntax.js'

const {expect: x} = chai
const {fps} = Prefixers
const {v} = builders

const DATA: FlatQuad[] = [
  // unwrap(fps.socrates, A, fps.man, fps.test),
  // [nn(':a'), nn(':foo'), nn(':b'), nn(':test')],
  // [nn(':b'), nn(':foo'), nn(':c'), nn(':test')],
]

for (let i = 0; i < 100_000; i++)
  DATA.push([nn(`:${i}`), nn(':foo'), nn(`:${i + 1}`), nn(':test')])

const QUERY: Expression = {
  type: 'Conjunction',
  first: {
    type: 'Pattern',
    terms: [vari('left'), nn(':foo'), vari('middle'), nn(':test')],
    order: 'SPOG',
  },
  rest: {
    type: 'Pattern',
    terms: [vari('middle'), nn(':foo'), vari('right'), nn(':test')],
    order: 'SPOG',
  },
}

function buildStore(data: FlatQuad[]) {
  const out = new Store()
  for (const d of data) out.add(d)
  return out
}

describe('query()', () => {
  it('evaluate', () => {
    let count = 0
    evaluate(buildStore(DATA), QUERY, () => count++)
    console.log(count)
  })
})
