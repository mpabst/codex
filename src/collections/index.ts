import { FlatTriple, Term } from '../term.js'
import * as tupleSet from './tuple-set.js'

export type Branch = tupleSet.TupleSet<Term>
export type Twig = Set<Term>
export type Node = Branch | Twig

export type Order = string

interface Data {
  [k: Order]: Branch
}

export class Index {
  static PLACES = 'SPO'.split('')
  static ORDERS = [
    // ...permute(3, TRIPLE_PLACES).map(o => o.join('') + 'G'),
    // GSPO index is only for the sake of whole graph operations; see comment in
    // #match()
    'SPO',
  ]

  static indexOrder(pattern: FlatTriple): Order {
    let litPlaces = ''
    let varPlaces = ''

    Index.PLACES.forEach((p, i) => {
      // graph term is at the end, so this loop will never hit it
      const t = pattern[i]
      t.termType === 'Variable' ? (varPlaces += p) : (litPlaces += p)
    })

    return litPlaces + varPlaces
  }

  static reorder(order: Order, triple: FlatTriple): FlatTriple {
    return order
      .split('')
      .map(o => triple[Index.PLACES.indexOf(o)]) as FlatTriple
  }

  private readonly data: Data = {}

  constructor(nodeCtor: MapConstructor = Map) {
    for (const o of Index.ORDERS) this.data[o] = new nodeCtor()
  }

  add(triple: FlatTriple): void {
    for (const order in this.data)
      this.addData(this.data[order], Index.reorder(order, triple))
  }

  protected addData(index: Branch, data: FlatTriple): void {
    tupleSet.add(index, data)
  }

  getOrder(order: Order): Branch {
    return this.data[order]
  }

  remove(triple: FlatTriple): void {
    for (const order in this.data)
      this.removeData(this.data[order], Index.reorder(order, triple))
  }

  protected removeData(index: Branch, data: FlatTriple): void {
    tupleSet.remove(index, data)
  }
}
