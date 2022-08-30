import { Quad, Term, Triple } from '../term.js'

const PLACES: { [k: string]: keyof Quad } = {
  G: 'graph',
  S: 'subject',
  P: 'predicate',
  O: 'object',
}

export type Order = string

export type TripleRoot<Twig> = Map<Term, Map<Term, Twig>>
type QuadRoot<Twig> = Map<Term, TripleRoot<Twig>>

export abstract class DataSet<D extends { [k: string]: Term }> {
  protected readonly order: (keyof D)[]
  protected _size: number = 0
  public abstract root: Map<Term, any>

  constructor(order: Order) {
    this.order = order.split('').map(s => PLACES[s] as keyof D)
  }

  abstract add(data: D): void

  abstract delete(data: D): void

  get size(): number {
    return this._size
  }

  protected reorder(data: D): Term[] {
    return this.order.map(o => data[o])
  }
}

export class TripleSet extends DataSet<Triple> {
  protected Branch: MapConstructor = Map
  protected Leaf: SetConstructor = Set
  public root: TripleRoot<Set<Term>> = new this.Branch()

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
      next = new this.Leaf()
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

export class TripleMultiSet extends DataSet<Triple> {
  public root: TripleRoot<Map<Term, number>> = new Map()
  #distinct: number = 0

  add(data: Triple): boolean {
    let result = false
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
    const count = next.get(path[2])
    if (!count) {
      next.set(path[2], 1)
      this.#distinct++
      result = true
    } else next.set(path[2], count + 1)
    this._size++
    return result
  }

  delete(data: Triple): boolean {
    let result = false
    const path = this.reorder(data)
    const a = this.root.get(path[0])!
    // don't nilcheck for now...
    const b = a.get(path[1])!
    const count = b.get(path[2])!
    if (count === 1) {
      b.delete(path[2])
      if (b.size === 0) a.delete(path[1])
      if (a.size === 0) this.root.delete(path[0])
      this.#distinct--
      result = true
    } else b.set(path[2], count - 1)
    this._size--
    return result
  }

  get distinct(): number {
    return this.#distinct
  }
}

class QuadSet extends DataSet<Quad> {
  public root: QuadRoot<Set<Term>> = new Map()

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
    if (c.size === 0) b.delete(path[2])
    if (b.size === 0) a.delete(path[1])
    if (a.size === 0) this.root.delete(path[0])
    this._size--
  }
}
