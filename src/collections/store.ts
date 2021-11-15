import { permute } from './iterable.js'
import * as tupleSet from './tuple-set.js'
import { FlatQuad, Term } from '../term.js'

export type Branch = tupleSet.TupleSet<Term>
export type Twig = Set<Term>
export type Node = Branch | Twig

export type Order = string

const TRIPLE_PLACES = 'SPO'.split('')
const PLACES = [...TRIPLE_PLACES, 'G']
const ORDERS = [
  'SPOG',
  // ...permute(3, TRIPLE_PLACES).map(o => o.join('') + 'G'),
  // GSPO index is only for the sake of whole graph operations; see comment in
  // #match()
  // 'GSPO',
]

export interface Store {
  [k: Order]: Branch
}

export function add(store: Store, quad: FlatQuad): void {
  if (quad.some(t => t.termType === 'Variable'))
    throw new TypeError("Can't add variables")
  for (const [order, index] of Object.entries(store))
    tupleSet.add(index, reorder(order, quad))
}

export function store(): Store {
  const out: Store = {}
  for (const o of ORDERS) out[o] = new Map()
  return out
}

export function indexOrder(pattern: FlatQuad): Order {
  let litPlaces = ''
  let varPlaces = ''

  TRIPLE_PLACES.forEach((p, i) => {
    // graph term is at the end, so this loop will never hit it
    const t = pattern[i]
    t.termType === 'Variable' ? (varPlaces += p) : (litPlaces += p)
  })
  // TODO: We can only use the GSPO index if the graph term is a base - rather
  // than virtual - graph (and we have the right selection of variable terms)
  // so let's just not worry about it for now.
  return litPlaces + varPlaces + 'G'
}

export function reorder(order: Order, data: FlatQuad): FlatQuad {
  return order.split('').map(o => data[PLACES.indexOf(o)]) as FlatQuad
}
