import { Triple } from '../term.js'
import { DataSet, Order, TripleSet } from './data-set.js'

export class Index<D extends DataSet<Triple> = TripleSet> {
  protected data = new Map<Order, D>()

  constructor(protected orders: Order[] = ['SPO'], Data: new (o: string) => D) {
    for (const o of orders) this.data.set(o, new Data(o))
  }

  add(triple: Triple): void {
    for (const ts of this.data.values()) ts.add(triple)
  }

  delete(triple: Triple): void {
    for (const ts of this.data.values()) ts.delete(triple)
  }

  getRoot(order: Order) {
    return this.data.get(order)!.root
  }

  get size(): number {
    return this.data.get(this.orders[0])!.size
  }
}
