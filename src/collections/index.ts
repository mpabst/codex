import { Term, Triple } from '../term.js'
import { DataSet, Order, TripleMultiSet, TripleRoot, TripleSet } from './data-set.js'
import { VTTripleSet } from './var-tracking.js'

export class Index {
  protected Data = TripleSet
  protected data = new Map<Order, DataSet<Triple>>()

  constructor(protected orders: Order[] = ['SPO']) {
    for (const o of orders) this.data.set(o, new this.Data(o))
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

export class MultiIndex extends Index {
  protected multi: TripleMultiSet

  constructor(protected multiOrder: Order = 'SPO', otherOrders: Order[] = []) {
    super(otherOrders)
    this.multi = new TripleMultiSet(multiOrder)
  }

  add(triple: Triple): void {
    if (this.multi.add(triple)) super.add(triple)
  }

  delete(triple: Triple): void {
    if (this.multi.delete(triple)) super.delete(triple)
  }
}

export class VTIndex extends Index {
  protected Data = VTTripleSet
}
