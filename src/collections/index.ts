import * as tupleSet from './tuple-set.js'
import {FlatQuad, Term} from '../term.js'

export type Branch = tupleSet.TupleSet<Term>
export type Twig = Set<Term>
export type Node = Branch | Twig

export type Order = string

interface Data {
  [k: Order]: Branch
}

export class Index {
  static TRIPLE_PLACES = 'SPO'.split('')
  static PLACES = [...Index.TRIPLE_PLACES, 'G']
  static ORDERS = [
    'SPOG',
    // ...permute(3, TRIPLE_PLACES).map(o => o.join('') + 'G'),
    // GSPO index is only for the sake of whole graph operations; see comment in
    // #match()
    // 'GSPO',
  ]

  static indexOrder(pattern: FlatQuad): Order {
    let litPlaces = ''
    let varPlaces = ''

    Index.TRIPLE_PLACES.forEach((p, i) => {
      // graph term is at the end, so this loop will never hit it
      const t = pattern[i]
      t.termType === 'Variable' ? (varPlaces += p) : (litPlaces += p)
    })
    // TODO: We can only use the GSPO index if the graph term is a base - rather
    // than virtual - graph (and we have the right selection of variable terms)
    // so let's just not worry about it for now.
    return litPlaces + varPlaces + 'G'
  }

  static reorder(order: Order, data: FlatQuad): FlatQuad {
    return order.split('').map((o) => data[Index.PLACES.indexOf(o)]) as FlatQuad
  }

  private readonly data: Data = {}

  constructor() {
    for (const o of Index.ORDERS) this.data[o] = new Map()
  }

  add(quad: FlatQuad): void {
    // if (quad.some(t => t.termType === 'Variable'))
    //   throw new TypeError("Can't add variables")
    for (const [order, index] of Object.entries(this))
      tupleSet.add(index, Index.reorder(order, quad))
  }

  getIndex(order: Order): Branch {
    return this.data[order]
  }
}
