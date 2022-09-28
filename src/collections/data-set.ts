import { Quad, Term, Triple } from '../term.js'

const PLACES: { [k: string]: keyof Quad } = {
  G: 'graph',
  S: 'subject',
  P: 'predicate',
  O: 'object',
}

export type Order = string

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

  abstract add(data: D): void

  abstract delete(data: D): void

  protected reorder(data: D): Term[] {
    return this.order.map(o => data[o])
  }
}

export class TripleSet extends DataSet<Triple> {
  root = new this.Branch()

  add(data: Triple): void {
    const path = this.reorder(data)
    let next = this.root.get(path[0]) as any
    if (!next) {
      next = new this.Branch()
      this.root.set(path[0], next)
    }
    let node = next
    next = node.get(path[1])
    if (!next) {
      next = new this.Twig()
      node.set(path[1], next)
    }
    next.add(path[2])
    this._size++
  }

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
}

export class QuadSet extends DataSet<Quad> {
  root = new this.Branch()

  add(data: Quad): void {
    const path = this.reorder(data)
    let next = this.root.get(path[0]) as any
    if (!next) {
      next = new Map()
      this.root.set(path[0], next)
    }
    let node = next
    next = node.get(path[1])
    if (!next) {
      next = new Map()
      node.set(path[1], next)
    }
    node = next
    next = node.get(path[2])
    if (!next) {
      next = new Set()
      node.set(path[2], next)
    }
    next.add(path[3])
    this._size++
  }

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
}
