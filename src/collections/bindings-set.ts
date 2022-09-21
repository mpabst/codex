import { Bindings } from '../machine.js'
import { Term, Variable } from '../term.js'

export class BindingsSet {
  protected readonly root = new Map()
  protected order: Variable[]
  #size: number = 0

  constructor(b: Set<Variable>) {
    this.order = Array.from(b)
  }

  protected reorder(b: Bindings): Term[] {
    return this.order.map(o => b.get(o)!)
  }

  add(b: Bindings): void {
    const path = this.reorder(b)
    let node = this.root
    let next: any
    for (let i = 0; i < path.length - 2; i++) {
      next = node.get(path[i])
      if (!next) {
        next = new Map()
        node.set(path[i], next)
      }
      node = next
    }
    const penult = path[path.length - 2]
    next = node.get(penult)
    if (!next) {
      next = new Set()
      node.set(penult, next)
    }
    next.add(path[path.length - 1])
    this.#size++
  }

  get size(): number {
    return this.#size
  }

  has(b: Bindings): boolean {
    const path = this.reorder(b)
    let node = this.root
    let next: any
    for (let i = 0; i < path.length - 1; i++) {
      next = node.get(path[i])
      if (!next) return false
      node = next
    }
    return next.has(path[path.length - 1])
  }

  delete(b: Bindings): void {
    const path = this.reorder(b)
    let node = this.root
    const trail: any[] = [node]
    let next: any
    for (let i = 0; i < path.length - 1; i++) {
      next = node.get(path[i])
      node = next
      trail.push(node)
    }
    node.delete(path[path.length - 1])
    for (let i = trail.length - 1; i > 0; i--)
      if (trail[i].size === 0) trail[i - 1].delete(path[i - 1])
    this.#size--
  }
}
