import { Quad, Term, Triple } from '../term.js'
import { Index } from './index.js'

const PLACES: { [k: string]: keyof Quad } = {
  G: 'graph',
  S: 'subject',
  P: 'predicate',
  O: 'object',
}

export type Order = string
type Twig = Set<Term>
type Branch = Map<Term, any>
type Node = Set<Term> | Map<Term, any>

const TRIPLE_LENGTH = 3
const QUAD_LENGTH = 4

export abstract class DataSet {
  protected readonly Branch: MapConstructor = Map
  protected readonly Twig: SetConstructor = Set

  protected abstract readonly pathLength: number
  protected _size: number = 0

  abstract root: Map<Term, any>

  get size(): number {
    return this._size
  }

  protected addPath(path: Term[]): void {
    let prev = this.root
    let next
    for (let i = 0; i < this.pathLength - 1; i++) {
      next = prev.get(path[i])
      if (next) prev = next
      else {
        prev.set(path[i], this.buildTail(path, i + 1))
        return
      }
    }
    next.add(path[this.pathLength - 1])
    this._size++
  }

  protected buildTail(path: Term[], start: number) {
    let prev: Node = new this.Twig()
    prev.add(path[this.pathLength - 1])
    for (let i = this.pathLength - 2; i >= start; i--) {
      let next = new this.Branch()
      next.set(path[i], prev)
      prev = next
    }
    return prev
  }

  protected deletePath(path: Term[]): void {
    const nodes = this.mapPath(path)
    if (nodes.length !== this.pathLength) return // not found
    nodes[nodes.length - 1].delete(path[path.length - 1])
    for (let i = nodes.length - 2; i > 0; i--)
      if (nodes[i].size === 0) nodes[i - 1].delete(path[i])
    this._size--
  }

  protected forEachPath(cb: (d: Term[]) => void): void {
    const found: Term[] = []
    const recursive = (node: Node, place: number) => {
      if (node instanceof this.Twig)
        for (const term of node) {
          found[place] = term
          cb(found)
        }
      else
        for (const [key, val] of node) {
          found[place] = key
          recursive(val, place + 1)
        }
    }
    recursive(this.root, 0)
  }

  protected mapPath(path: Term[]): Node[] {
    const out: Node[] = []
    let next: Branch = this.root
    for (const term of path) {
      out.push(next)
      if (next instanceof this.Twig) break
      next = next.get(term)
      if (!next) break
    }
    return out
  }
}

// flat and curly, like parsley ^_^
export abstract class CurlyDataSet<
  D extends { [k: string]: Term } = { [k: string]: Term },
> extends DataSet {
  readonly order: (keyof D)[]

  constructor(order: Order, public parent: Index | null = null) {
    super()
    this.order = order.split('').map(s => PLACES[s] as keyof D)
  }

  add(datum: D): void {
    super.addPath(this.reorder(datum))
  }

  delete(datum: D): void {
    super.deletePath(this.reorder(datum))
  }

  protected deorder(path: Term[]): D {
    const out: Partial<D> = {}
    for (let i = 0; i < path.length; i++) (out[this.order[i]] as any) = path[i]
    return out as D
  }

  forEach(cb: (d: D) => void): void {
    this.forEachPath((path: Term[]) => cb(this.deorder(path)))
  }

  map<T>(cb: (d: D) => T): T[] {
    const out: T[] = []
    this.forEach(d => out.push(cb(d)))
    return out
  }

  protected reorder(datum: D): Term[] {
    return this.order.map(o => datum[o])
  }
}

export class TripleSet extends CurlyDataSet<Triple> {
  pathLength = TRIPLE_LENGTH
  root = new this.Branch()
}

export class QuadSet extends CurlyDataSet<Quad> {
  pathLength = QUAD_LENGTH
  root = new this.Branch()
}
