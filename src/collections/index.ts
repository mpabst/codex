import { prefixify, Printer, stringifyTriple } from '../debug.js'
import {
  BlankNode,
  Name,
  Subject,
  Term,
  Triple,
  TRIPLE_PLACES,
} from '../term.js'
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
    const floaters = new Set<BlankNode>()
    const printed = new Set<BlankNode>()
    const printer = new Printer()
    const p = printer.send.bind(printer)

    const spo = this.getRoot('SPO')

    function printSubject(subj: Subject, level: number = 0): void {
      const po = [...spo.get(subj)] as [Term, Set<Term>][]
      if (level === 0) p(subj, po.length > 1 ? '\n' : ' ')
      printer.indent()
      po.forEach(([pred, oSet], i) => {
        const oAry = [...oSet]
        p(pred, oAry.length > 1 ? '\n' : ' ')
        ;[...oAry].forEach((o, i) => {
          if (!(o instanceof BlankNode) || printed.has(o)) p(o)
          else {
            printed.add(o)
            floaters.delete(o)
            p(`[ ${o}\n`)
            printSubject(o, level + 1)
            p(']')
          }
          if (i < oAry.length - 1) p(' ,\n')
        })
        if (i < po.length - 1) p(' ;\n')
      })
      if (level === 0) p(' .\n')
      printer.outdent()
    }

    // print only named subjects at first, collect bnodes while printing them,
    // only print bnodes at the end which haven't been printed as part of
    // another subject - need to compute trans closure to find bnode roots,
    // which isn't worth it - maybe just unnest all bnode children of (other)
    // leftover bnodes
    for (const subj of spo.keys())
      if (subj instanceof BlankNode) {
        if (!printed.has(subj)) floaters.add(subj)
      } else printSubject(subj)
    for (const subj of floaters) {
      printed.add(subj)
      printSubject(subj)
    }
  }
}
