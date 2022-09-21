import { Term, Triple } from '../term.js'
import { Order, TripleRoot, TripleSet } from './data-set.js'

export class Index {
  protected data = new Map<Order, TripleSet>()

  constructor(protected orders: Order[] = ['SPO']) {
    for (const o of orders) this.data.set(o, new TripleSet(o))
  }

  add(triple: Triple): void {
    for (const ts of this.data.values()) ts.add(triple)
  }

  delete(triple: Triple): void {
    for (const ts of this.data.values()) ts.delete(triple)
  }

  getRoot(order: Order): TripleRoot<Set<Term>> {
    return this.data.get(order)!.root
  }

  get size(): number {
    return this.data.get(this.orders[0])!.size
  }
}
