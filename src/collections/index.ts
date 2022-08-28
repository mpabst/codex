import { FlatTriple, Term, Triple } from '../term.js'
import * as tupleSet from './tuple-set.js'

export type Branch = tupleSet.TupleSet<Term>
export type Twig = Set<Term>
export type Node = Branch | Twig

export type Order = string

interface Data {
  [k: Order]: Branch
}

// subclass with a MultiIndex, with SPO as TupleMultiSet
// and always present

export class Index {

  static PLACES: { [k: string]: keyof Triple } = {
    S: 'subject',
    P: 'predicate',
    O: 'object',
  }

  static ORDERS = [
    // ...permute(3, TRIPLE_PLACES).map(o => o.join('') + 'G'),
    // GSPO index is only for the sake of whole graph operations; see comment in
    // #match()
    'PSO',
    'POS',
    'SPO',
    'OPS'
  ]

  static reorder(order: Order, triple: Triple): FlatTriple {
    return order.split('').map(o => triple[Index.PLACES[o]]) as FlatTriple
  }

  protected readonly data: Data = {}
  #size: number = 0

  constructor(nodeCtor: MapConstructor = Map) {
    for (const o of Index.ORDERS) this.data[o] = new nodeCtor()
  }

  add(triple: Triple): void {
    for (const order in this.data)
      this.addData(this.data[order], Index.reorder(order, triple))
    this.#size++
  }

  protected addData(index: Branch, data: FlatTriple): void {
    tupleSet.add(index, data)
  }

  getOrder(order: Order): Branch {
    return this.data[order]
  }

  remove(triple: Triple): void {
    for (const order in this.data)
      this.removeData(this.data[order], Index.reorder(order, triple))
    this.#size--
  }

  protected removeData(index: Branch, data: FlatTriple): void {
    tupleSet.remove(index, data)
  }

  get size(): number {
    return this.#size
  }
}
