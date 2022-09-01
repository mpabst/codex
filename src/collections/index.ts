import { Leaf } from '../operations.js'
import { Triple } from '../term.js'
import {
  DataSet,
  Order,
  TripleMultiSet,
  TripleRoot,
  TripleSet,
} from './data-set.js'
import { VTTripleSet } from './var-tracking.js'

export class Index {
  protected data = new Map<Order, DataSet<Triple>>()

  constructor(
    protected orders: Order[] = ['SPO'],
    Data: new (o: Order) => DataSet<Triple> = TripleSet,
  ) {
    for (const o of orders) this.data.set(o, new Data(o))
  }

  add(triple: Triple): void {
    for (const ts of this.data.values()) ts.add(triple)
  }

  delete(triple: Triple): void {
    for (const ts of this.data.values()) ts.delete(triple)
  }

  getRoot(order: Order): TripleRoot<Leaf> {
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

  getRoot(order: Order): TripleRoot<Leaf> {
    if (order === this.multiOrder) return this.multi.root
    else return super.getRoot(order)
  }
}

export class VTIndex extends Index {
  constructor(orders: Order[] = ['SPO']) {
    super(orders, VTTripleSet)
  }
}
