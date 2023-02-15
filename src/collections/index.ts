import { prefixify, stringifyTriple } from '../debug.js'
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
    const spo = this.getRoot('SPO')

    class Printer {
      #buf: string
      #indent = ''

      constructor(indent: number) {
        for (let i = 0; i < indent; i++) this.#indent += ' '
        this.#buf = this.#indent
      }

      print(...args: (Term | string)[]): void {
        for (const arg of args)
          if (arg instanceof Term) this.print(prefixify(arg))
          else
            for (const char of arg)
              if (char === '\n') {
                console.log(this.#buf)
                this.#buf = this.#indent
              } else this.#buf += char
      }
    }

    function printSubject(subj: Subject, indent: number = 0): void {
      const printer = new Printer(indent)
      const p = printer.print.bind(printer)

      const po = spo.get(subj) as Map<Term, Set<Term>>
      p(subj, po.size > 1 ? '\n' : ' ')
      for (const [pred, os] of po) {
        p(pred, os.size > 1 ? '\n' : ' ')
        ;[...os].forEach((o, i) => {
          if (o instanceof BlankNode) {
            p(`[ ${o}\n`)
            printSubject(o)
            p(']')
          } else p(o)
          if (i < os.size - 1) p(' ,\n')
        })
        p(' ;\n')
      }
      p(' .\n')
    }

    // print only named subjects at first, collect bnodes while printing them,
    // only print bnodes at the end which haven't been printed as part of
    // another subject - need to compute trans closure to find bnode roots,
    // which isn't worth it - maybe just unnest all bnode children of (other)
    // leftover bnodes
    for (const subj of spo.keys()) printSubject(subj)
  }
}
