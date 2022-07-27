import {Term, turtle, FlatTriple, FlatQuad, DEFAULT_GRAPH} from './term.js'

abstract class Dictionary<T> {
  protected readonly data = new Map<string, T>()

  clear(): void {
    this.data.clear()
  }

  abstract key(t: T): string

  lookup(t: T): T {
    const key = this.key(t)
    const found = this.data.get(key)
    if (!found) this.data.set(key, t)
    return found || t
  }
}

export class TermDictionary extends Dictionary<Term> {
  constructor() {
    super()
    this.lookup(DEFAULT_GRAPH)
  }

  clear(): void {
    super.clear()
    this.lookup(DEFAULT_GRAPH)
  }

  key(t: Term): string {
    return turtle(t)
  }
}

// TODO: Convert to TupleMap? Do perf test
abstract class TupleDictionary<T extends Term[]> extends Dictionary<T> {
  key(q: T): string {
    return q.map(turtle).join(' ')
  }
}

export class TripleDictionary extends TupleDictionary<FlatTriple> {}

export class QuadDictionary extends TupleDictionary<FlatQuad> {}
