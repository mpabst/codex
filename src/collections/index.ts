import { stringifyTriple } from '../debug.js'
import { Name, Triple, TRIPLE_PLACES } from '../term.js'
import { CurlyDataSet, Order, TripleSet } from './data-set.js'

export class Index<D extends CurlyDataSet = TripleSet> {
  data = new Map<Order, D>()

  constructor(
    public name: Name,
    Data: new (o: string, i: Index<D>) => D,
    protected orders: Order[] = ['SPO'],
  ) {
    for (const o of orders) this.data.set(o, new Data(o, this))
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

  // @debug
  toStrings(): string[][] {
    const out: string[][] = []
    this.data.get('SPO')!.forEach(t => {
      out.push(stringifyTriple(t as Triple))
    })
    return out
  }

  // @debug
  print(): void {
    console.log(
      this.toStrings()
        .map(t => t.join(' '))
        .join('\n'),
    )
  }
}
