import { Quad, Term, Triple } from '../term.js'

const PLACES: { [k: string]: keyof Quad } = {
  G: 'graph',
  S: 'subject',
  P: 'predicate',
  O: 'object',
}

export type Order = string

const TRIPLE_LENGTH = 3
const QUAD_LENGTH = 4

export abstract class DataSet<D extends { [k: string]: Term }> {
  protected readonly Branch: MapConstructor = Map
  protected readonly Twig: SetConstructor = Set

  readonly order: (keyof D)[]
  protected _size: number = 0

  abstract root: Map<Term, any>

  constructor(order: Order) {
    this.order = order.split('').map(s => PLACES[s] as keyof D)
  }

  get size(): number {
    return this._size
  }

  add(data: D): this {
    this._size++
    const path = this.reorder(data)
    let prev = this.root
    let next
    for (let i = 0; i < this.pathLength - 1; i++) {
      next = prev.get(path[i])
      if (next) prev = next
      else {
        prev.set(path[i], this.buildTail(path, i + 1)) 
        return this
      }
    }
    next.add(path[this.pathLength - 1])
    return this
  }

  buildTail(path: Term[], start: number) {
    let prev: any = new this.Twig()
    prev.add(path[this.pathLength - 1])
    for (let i = this.pathLength - 2; i >= start; i--) {
      let next = new this.Branch()
      next.set(path[i], prev)
      prev = next
    }
    return prev
  }

  abstract delete(data: D): void

  abstract get pathLength(): number

  protected reorder(data: D): Term[] {
    return this.order.map(o => data[o])
  }
}

export class TripleSet extends DataSet<Triple> {
  root = new this.Branch()

  delete(data: Triple): void {
    const path = this.reorder(data)
    const a = this.root.get(path[0])!
    // don't nilcheck for now...
    const b = a.get(path[1])!
    b.delete(path[2])
    if (b.size === 0) a.delete(path[1])
    if (a.size === 0) this.root.delete(path[0])
    this._size--
  }

  get pathLength(): number {
    return TRIPLE_LENGTH
  }
}

export class QuadSet extends DataSet<Quad> {
  root = new this.Branch()

  delete(data: Quad): void {
    const path = this.reorder(data)
    const a = this.root.get(path[0])!
    // don't nilcheck for now...
    const b = a.get(path[1])!
    const c = b.get(path[2])!
    c.delete(path[3])
    if (c.size === 0) {
      b.delete(path[2])
      if (b.size === 0) {
        a.delete(path[1])
        if (a.size === 0) this.root.delete(path[0])
      }
    }
    this._size--
  }

  forEach(cb: (q: Quad) => void): void {
    const out: Partial<Quad> = {}
    for (const [a, bs] of this.root) {
      out[this.order[0]] = a
      for (const [b, cs] of bs) {
        out[this.order[1]] = b
        for (const [c, ds] of cs) {
          out[this.order[2]] = c
          for (const d of ds) {
            out[this.order[3]] = d
            cb(out as Quad)
          }
        }
      }
    }
  }

  get pathLength(): number {
    return QUAD_LENGTH
  }
}
